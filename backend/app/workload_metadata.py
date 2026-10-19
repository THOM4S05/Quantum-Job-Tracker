"""Compiler/resource snapshots. Estimates are never inferred from job results."""

import json
from datetime import timedelta, timezone

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, JsonValue, field_validator, model_validator

MAX_COUNT = 9_007_199_254_740_991  # Exact integer range shared with the browser.


class JobDurations(BaseModel):
    compilation_seconds: float | None = None
    queue_seconds: float | None = None
    execution_seconds: float | None = None


class WorkloadMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    program_name: str | None = Field(default=None, min_length=1, max_length=160)
    program_revision: str | None = Field(default=None, min_length=1, max_length=160)
    source_language: str | None = Field(default=None, min_length=1, max_length=80)
    compiler_name: str | None = Field(default=None, min_length=1, max_length=120)
    compiler_version: str | None = Field(default=None, min_length=1, max_length=80)
    optimisation_settings: dict[str, JsonValue] | None = None
    requested_shots: int | None = Field(default=None, strict=True, ge=1, le=MAX_COUNT)
    estimated_logical_qubits: int | None = Field(default=None, strict=True, ge=0, le=MAX_COUNT)
    estimated_circuit_depth: int | None = Field(default=None, strict=True, ge=0, le=MAX_COUNT)
    estimated_gate_count: int | None = Field(default=None, strict=True, ge=0, le=MAX_COUNT)
    compilation_started_at: AwareDatetime | None = None
    compilation_finished_at: AwareDatetime | None = None
    queue_entered_at: AwareDatetime | None = None
    queue_left_at: AwareDatetime | None = None
    execution_started_at: AwareDatetime | None = None
    execution_finished_at: AwareDatetime | None = None

    @field_validator("compilation_started_at", "compilation_finished_at", "queue_entered_at", "queue_left_at",
                     "execution_started_at", "execution_finished_at")
    @classmethod
    def utc_timestamp(cls, value):
        return value.astimezone(timezone.utc) if value is not None else None

    @field_validator("optimisation_settings")
    @classmethod
    def finite_json(cls, value):
        json.dumps(value, allow_nan=False)
        return value

    @model_validator(mode="after")
    def timestamp_order(self):
        points = [self.compilation_started_at, self.compilation_finished_at,
                  self.queue_entered_at, self.queue_left_at,
                  self.execution_started_at, self.execution_finished_at]
        known = [point for point in points if point is not None]
        if any(right < left for left, right in zip(known, known[1:])):
            raise ValueError("Recorded phase timestamps must be chronological")
        return self

    def durations(self) -> JobDurations:
        def seconds(start, end):
            return None if start is None or end is None else round((end - start).total_seconds(), 6)
        return JobDurations(
            compilation_seconds=seconds(self.compilation_started_at, self.compilation_finished_at),
            queue_seconds=seconds(self.queue_entered_at, self.queue_left_at),
            execution_seconds=seconds(self.execution_started_at, self.execution_finished_at),
        )


def synthetic_metadata(index: int, name: str, scenario: str, created) -> WorkloadMetadata:
    """Fixture-only phase boundaries, matching the existing synthetic history."""
    compiling = scenario not in {"queued", "cancelled"}
    queueing = compiling and scenario != "compilation_failure"
    executing = queueing and scenario != "queueing_failure"
    return WorkloadMetadata(
        program_name=name, program_revision=f"synthetic-r{index % 5 + 1}",
        source_language="Synthetic QASM-like",
        compiler_name=("Synthetic Aurora Compiler", "Synthetic Nebula Compiler", "Synthetic Quasar Compiler")[index % 3],
        compiler_version=None if index % 17 == 0 else "synthetic-1.0.0",
        optimisation_settings={"level": index % 3, "routing": "synthetic-greedy"},
        requested_shots=1024,
        estimated_logical_qubits=None if index % 13 == 0 else 8 + index % 4 * 8,
        estimated_circuit_depth=None if index % 13 == 0 else 120 + index % 40,
        estimated_gate_count=None if index % 13 == 0 else 600 + index % 100,
        compilation_started_at=created + timedelta(seconds=1) if compiling else None,
        compilation_finished_at=created + timedelta(seconds=2) if compiling else None,
        queue_entered_at=created + timedelta(seconds=2) if queueing else None,
        queue_left_at=created + timedelta(seconds=3) if queueing else None,
        execution_started_at=created + timedelta(seconds=3) if executing else None,
        execution_finished_at=(created + timedelta(seconds=5 if scenario == "success" else 4))
        if scenario in {"success", "execution_failure"} else None,
    )
