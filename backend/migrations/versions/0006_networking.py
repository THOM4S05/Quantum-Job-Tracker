"""Add synthetic networking records and parent-locked evidence guards."""
from alembic import op

revision = '0006_networking'
down_revision = '0005_metadata_counts'
branch_labels = depends_on = None


def upgrade():
    op.execute('''
CREATE TABLE networked_runs (
	job_id UUID NOT NULL,
	execution_method VARCHAR(40) NOT NULL,
	schema_version VARCHAR(20) NOT NULL,
	plan_version VARCHAR(40) NOT NULL,
	synthetic BOOLEAN NOT NULL,
	PRIMARY KEY (job_id),
	CONSTRAINT ck_networked_plan CHECK (execution_method = 'entanglement_network' AND schema_version = '1' AND plan_version = 'two-machine-v1' AND synthetic),
	FOREIGN KEY(job_id) REFERENCES jobs (id) ON DELETE RESTRICT
)

''')
    op.execute('''
CREATE TABLE execution_parts (
	id UUID NOT NULL,
	job_id UUID NOT NULL,
	label VARCHAR(80) NOT NULL,
	provider VARCHAR(80) NOT NULL,
	target VARCHAR(120) NOT NULL,
	role VARCHAR(80) NOT NULL,
	qubit_ids JSONB NOT NULL,
	status VARCHAR(24) NOT NULL,
	started_at TIMESTAMP WITH TIME ZONE,
	prepared_at TIMESTAMP WITH TIME ZONE,
	finished_at TIMESTAMP WITH TIME ZONE,
	failure_code VARCHAR(80),
	failure_message TEXT,
	PRIMARY KEY (id),
	CONSTRAINT uq_parts_parent_id UNIQUE (job_id, id),
	CONSTRAINT uq_parts_label UNIQUE (job_id, label),
	CONSTRAINT ck_parts_status CHECK (status IN ('pending','preparing','blocked','completed','aborted')),
	CONSTRAINT ck_parts_qubits CHECK (jsonb_typeof(qubit_ids) = 'array'),
	CONSTRAINT ck_parts_times CHECK ((status = 'pending') = (started_at IS NULL) AND (status IN ('completed','aborted')) = (finished_at IS NOT NULL) AND (prepared_at IS NULL OR prepared_at >= started_at) AND (finished_at IS NULL OR finished_at >= started_at)),
	CONSTRAINT ck_parts_failure CHECK ((failure_code IS NULL) = (failure_message IS NULL)),
	FOREIGN KEY(job_id) REFERENCES networked_runs (job_id) ON DELETE RESTRICT
)

''')
    op.execute('''
CREATE TABLE quantum_links (
	id UUID NOT NULL,
	job_id UUID NOT NULL,
	part_a_id UUID NOT NULL,
	part_b_id UUID NOT NULL,
	channel_type VARCHAR(40) NOT NULL,
	PRIMARY KEY (id),
	FOREIGN KEY(job_id, part_a_id) REFERENCES execution_parts (job_id, id),
	FOREIGN KEY(job_id, part_b_id) REFERENCES execution_parts (job_id, id),
	CONSTRAINT uq_link_parent UNIQUE (job_id),
	CONSTRAINT ck_link_distinct CHECK (part_a_id <> part_b_id),
	CONSTRAINT ck_link_channel CHECK (channel_type = 'synthetic_entanglement'),
	FOREIGN KEY(job_id) REFERENCES networked_runs (job_id) ON DELETE RESTRICT
)

''')
    op.execute('''
    CREATE FUNCTION guard_network_record() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE parent_status text; parent_id uuid;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Network evidence cannot be deleted' USING ERRCODE = '23514';
      END IF;
      parent_id := NEW.job_id;
      SELECT status INTO parent_status FROM jobs WHERE id = parent_id FOR UPDATE;
      IF parent_status IN ('succeeded','failed','cancelled') THEN
        RAISE EXCEPTION 'Terminal network evidence is immutable' USING ERRCODE = '23514';
      END IF;
      IF TG_TABLE_NAME = 'execution_parts' AND TG_OP = 'INSERT' THEN
        IF NEW.status <> 'pending' OR (SELECT count(*) FROM execution_parts WHERE job_id = parent_id) >= 2 THEN
          RAISE EXCEPTION 'This plan requires two initially pending parts' USING ERRCODE = '23514';
        END IF;
      END IF;
      IF TG_TABLE_NAME = 'networked_runs'  AND (SELECT specification->>'execution_method' FROM jobs WHERE id = parent_id) IS DISTINCT FROM 'entanglement_network' THEN
        RAISE EXCEPTION 'Network plan requires distributed submission specification' USING ERRCODE = '23514';
      END IF;
      IF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME <> 'execution_parts' OR
           (to_jsonb(NEW) - ARRAY['status','started_at','prepared_at','finished_at','failure_code','failure_message'])
           IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['status','started_at','prepared_at','finished_at','failure_code','failure_message']) THEN
          RAISE EXCEPTION 'Network plan is immutable' USING ERRCODE = '23514';
        END IF;
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER guard_network_record BEFORE INSERT OR UPDATE OR DELETE ON networked_runs FOR EACH ROW EXECUTE FUNCTION guard_network_record();
    CREATE TRIGGER guard_network_record BEFORE INSERT OR UPDATE OR DELETE ON execution_parts FOR EACH ROW EXECUTE FUNCTION guard_network_record();
    CREATE TRIGGER guard_network_record BEFORE INSERT OR UPDATE OR DELETE ON quantum_links FOR EACH ROW EXECUTE FUNCTION guard_network_record();

    CREATE FUNCTION guard_network_event() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE n jsonb; k text; parent_status text; required_keys text[]; req jsonb; prior_kind text;
    BEGIN
      n := NEW.details->'network';
      IF n IS NULL THEN RETURN NEW; END IF;
      SELECT status INTO parent_status FROM jobs WHERE id = NEW.job_id FOR UPDATE;
      IF NOT EXISTS (SELECT 1 FROM networked_runs WHERE job_id = NEW.job_id) OR NEW.stage <> 'execution'
         OR parent_status <> 'running' OR NEW.to_status <> 'running' THEN
        RAISE EXCEPTION 'Network events require a running network parent in execution' USING ERRCODE = '23514';
      END IF;
      k := n->>'kind';
      IF k IS NULL OR k NOT IN ('execution_started','part_started','local_prepared','part_completed','part_aborted','entanglement_requested','attempt_completed','entanglement_timeout','remote_started','remote_completed','final_output') THEN
        RAISE EXCEPTION 'Unknown networking event' USING ERRCODE = '23514';
      END IF;
      IF NEW.sequence <> (SELECT version FROM jobs WHERE id = NEW.job_id)
         OR NEW.occurred_at <> (SELECT updated_at FROM jobs WHERE id = NEW.job_id) THEN
        RAISE EXCEPTION 'Network event must agree with parent version and time' USING ERRCODE = '23514';
      END IF;
      required_keys := ARRAY['kind'];
      IF k IN ('part_started','local_prepared','part_completed','part_aborted') THEN
        required_keys := required_keys || ARRAY['part_id'];
      END IF;
      IF k IN ('entanglement_requested','attempt_completed','entanglement_timeout','remote_started','remote_completed') THEN
        required_keys := required_keys || ARRAY['link_id','operation_id'];
        IF n->>'operation_id' IS DISTINCT FROM 'remote-cz-1' THEN
          RAISE EXCEPTION 'Unknown remote operation' USING ERRCODE = '23514';
        END IF;
      END IF;
      IF k = 'entanglement_requested' THEN required_keys := required_keys || ARRAY['deadline']; END IF;
      IF k = 'attempt_completed' THEN
        required_keys := required_keys || ARRAY['attempt_id','outcome'];
        IF n->>'outcome' NOT IN ('failed','succeeded') THEN
          RAISE EXCEPTION 'Invalid attempt outcome' USING ERRCODE = '23514';
        END IF;
        IF n->>'outcome' = 'succeeded' THEN required_keys := required_keys || ARRAY['resource_id']; END IF;
      END IF;
      IF k IN ('remote_started','remote_completed') THEN required_keys := required_keys || ARRAY['resource_id']; END IF;
      IF k = 'final_output' THEN required_keys := required_keys || ARRAY['output']; END IF;
      IF NOT (n ?& required_keys) OR (n - required_keys) <> '{}'::jsonb
         OR EXISTS (SELECT 1 FROM jsonb_each(n) kv WHERE kv.value = 'null'::jsonb
                    OR (kv.key <> 'output' AND (jsonb_typeof(kv.value) <> 'string' OR length(trim(kv.value #>> '{}')) = 0)))
         OR (k = 'final_output' AND jsonb_typeof(n->'output') <> 'object') THEN
        RAISE EXCEPTION 'Invalid networking payload shape' USING ERRCODE = '23514';
      END IF;
      IF k = 'execution_started' THEN
        IF EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.job_id AND details->'network'->>'kind' = k) THEN
          RAISE EXCEPTION 'Duplicate execution start' USING ERRCODE = '23514';
        END IF;
      ELSIF NOT EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.job_id AND details->'network'->>'kind' = 'execution_started') THEN
        RAISE EXCEPTION 'Missing execution start' USING ERRCODE = '23514';
      END IF;
      SELECT details->'network' INTO req FROM job_events WHERE job_id = NEW.job_id
        AND details->'network'->>'kind' = 'entanglement_requested' ORDER BY sequence DESC LIMIT 1;
      IF k = 'entanglement_requested' THEN
        IF req IS NOT NULL OR (n->>'deadline')::timestamptz <= NEW.occurred_at
           OR (SELECT count(*) FROM execution_parts WHERE job_id = NEW.job_id AND status = 'blocked') <> 2 THEN
          RAISE EXCEPTION 'Request requires prepared parts and a future deadline' USING ERRCODE = '23514';
        END IF;
      END IF;
      IF k IN ('attempt_completed','entanglement_timeout') THEN
        IF req IS NULL OR EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.job_id AND
          (details->'network'->>'kind' = 'entanglement_timeout' OR (details->'network'->>'kind' = 'attempt_completed' AND details->'network'->>'outcome' = 'succeeded'))) THEN
          RAISE EXCEPTION 'No pending entanglement request' USING ERRCODE = '23514';
        END IF;
        IF (k = 'entanglement_timeout' AND NEW.occurred_at < (req->>'deadline')::timestamptz)
           OR (k = 'attempt_completed' AND NEW.occurred_at >= (req->>'deadline')::timestamptz)
           OR (k = 'attempt_completed' AND EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.job_id AND
               details->'network'->>'kind' = k AND details->'network'->>'attempt_id' = n->>'attempt_id')) THEN
          RAISE EXCEPTION 'Invalid attempt or deadline evidence' USING ERRCODE = '23514';
        END IF;
      END IF;
      IF k IN ('part_started','local_prepared','part_completed','part_aborted') THEN
        SELECT details->'network'->>'kind' INTO prior_kind FROM job_events WHERE job_id = NEW.job_id
          AND details->'network'->>'part_id' = n->>'part_id' ORDER BY sequence DESC LIMIT 1;
        IF (k = 'part_started' AND prior_kind IS NOT NULL)
           OR (k = 'local_prepared' AND prior_kind IS DISTINCT FROM 'part_started')
           OR (k = 'part_completed' AND (prior_kind IS DISTINCT FROM 'local_prepared' OR NOT EXISTS
               (SELECT 1 FROM job_events WHERE job_id = NEW.job_id AND details->'network'->>'kind' = 'remote_completed')))
           OR (k = 'part_aborted' AND (prior_kind IS NULL OR prior_kind NOT IN ('part_started','local_prepared') OR NOT EXISTS
               (SELECT 1 FROM job_events WHERE job_id = NEW.job_id AND details->'network'->>'kind' = 'entanglement_timeout'))) THEN
          RAISE EXCEPTION 'Invalid part evidence transition' USING ERRCODE = '23514';
        END IF;
      END IF;
      IF k = 'remote_completed' AND (NOT EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.job_id
        AND details->'network'->>'kind' = 'remote_started' AND details->'network'->>'resource_id' = n->>'resource_id')
        OR EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.job_id AND details->'network'->>'kind' = k)) THEN
        RAISE EXCEPTION 'Remote completion requires a unique start' USING ERRCODE = '23514';
      END IF;
      IF k = 'final_output' AND ((SELECT count(*) FROM execution_parts WHERE job_id = NEW.job_id AND status = 'completed') <> 2
        OR NOT EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.job_id AND details->'network'->>'kind' = 'remote_completed')
        OR EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.job_id AND details->'network'->>'kind' = k)) THEN
        RAISE EXCEPTION 'Output requires completed required parts and remote operation' USING ERRCODE = '23514';
      END IF;
      IF n ? 'part_id' AND NOT EXISTS (SELECT 1 FROM execution_parts WHERE job_id = NEW.job_id AND id = (n->>'part_id')::uuid) THEN
        RAISE EXCEPTION 'Cross-parent part event' USING ERRCODE = '23514';
      END IF;
      IF n ? 'link_id' AND NOT EXISTS (SELECT 1 FROM quantum_links WHERE job_id = NEW.job_id AND id = (n->>'link_id')::uuid) THEN
        RAISE EXCEPTION 'Cross-parent link event' USING ERRCODE = '23514';
      END IF;
      IF k = 'remote_started' THEN
        IF NOT EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.job_id AND sequence < NEW.sequence
          AND details->'network'->>'kind' = 'attempt_completed' AND details->'network'->>'outcome' = 'succeeded'
          AND details->'network'->>'resource_id' = n->>'resource_id'
          AND details->'network'->>'link_id' = n->>'link_id' AND details->'network'->>'operation_id' = n->>'operation_id')
          OR EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.job_id
          AND details->'network'->>'kind' = 'remote_started' AND details->'network'->>'resource_id' = n->>'resource_id') THEN
          RAISE EXCEPTION 'Pair must be generated and consumed once' USING ERRCODE = '23514';
        END IF;
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER guard_network_event BEFORE INSERT ON job_events FOR EACH ROW EXECUTE FUNCTION guard_network_event();

    CREATE FUNCTION check_network_terminal() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM networked_runs WHERE job_id = NEW.id) THEN RETURN NEW; END IF;
      IF NEW.status = 'succeeded' AND (
        (SELECT count(*) FROM execution_parts WHERE job_id = NEW.id AND status = 'completed') <> 2 OR
        NOT EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.id AND details->'network'->>'kind' = 'remote_completed') OR
        NOT EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.id AND details->'network'->>'kind' = 'final_output' AND details->'network'->'output' = NEW.result)) THEN
        RAISE EXCEPTION 'Network success requires completed parts, remote operation and output' USING ERRCODE = '23514';
      END IF;
      IF NEW.error_code = 'ENTANGLEMENT_TIMEOUT' AND (
        NEW.error_stage <> 'execution' OR NEW.result IS NOT NULL OR
        (SELECT count(*) FROM execution_parts WHERE job_id = NEW.id AND status = 'aborted') <> 2 OR
        NOT EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.id AND details->'network'->>'kind' = 'entanglement_timeout') OR
        EXISTS (SELECT 1 FROM job_events WHERE job_id = NEW.id AND details->'network'->>'kind' IN ('remote_completed','final_output'))) THEN
        RAISE EXCEPTION 'Invalid timeout outcome' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER check_network_terminal BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION check_network_terminal();
    ''')


def downgrade():
    op.execute('DROP TRIGGER check_network_terminal ON jobs; DROP FUNCTION check_network_terminal(); DROP TRIGGER guard_network_event ON job_events; DROP FUNCTION guard_network_event()')
    for table in ('quantum_links', 'execution_parts', 'networked_runs'):
        op.drop_table(table)
    op.execute('DROP FUNCTION guard_network_record()')
