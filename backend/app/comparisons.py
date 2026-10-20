"""Conservative configuration matching and descriptive experiment comparisons."""

import json
import math
from collections import defaultdict
from statistics import median
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.cohorts import cohort_options
from app.models import jobs
from app.overview import attempt, calculate_overview, interval


class ComparisonFilters(BaseModel):
    model_config = ConfigDict(extra="forbid")
    experiment: UUID | None = None
    baseline: str | None = Field(default=None, min_length=1, max_length=80)
    candidate: str | None = Field(default=None, min_length=1, max_length=80)

    @field_validator("baseline", "candidate", mode="before")
    @classmethod
    def strip_version(cls, value):
        return value.strip() if isinstance(value, str) else value

    @model_validator(mode="after")
    def distinct_versions(self):
        if self.baseline is not None and self.baseline == self.candidate:
            raise ValueError("Baseline and candidate must be different compiler versions")
        return self


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def configuration(job):
    metadata, spec = job.get("metadata") or {}, job.get("specification") or {}
    workload = spec.get("workload") if isinstance(spec.get("workload"), dict) else {}
    config = {key: metadata.get(key) for key in (
        "program_name", "program_revision", "source_language", "compiler_name", "requested_shots", "optimisation_settings")}
    config.update(provider=job.get("provider"), target=job.get("target"), inputs=workload.get("inputs"),
                  simulation_version=job.get("simulation_version"),
                  additional_settings={key: value for key, value in spec.items() if key not in {
                      "synthetic", "seed_dataset", "experiment", "workload", "run", "comparison", "shots"}},
                  additional_workload_settings={key: value for key, value in workload.items() if key not in {
                      "id", "key", "name", "program_revision", "inputs"}})
    missing = [key for key, value in config.items() if value is None or (isinstance(value, str) and not value.strip())]
    if workload.get("program_revision") is not None and workload["program_revision"] != config["program_revision"]:
        missing.append("inconsistent_program_revision")
    if spec.get("shots") is not None and spec["shots"] != config["requested_shots"]:
        missing.append("inconsistent_shots")
    logical = workload.get("key") or metadata.get("program_name") or f"Unknown workload / {job['id']}"
    return str(logical), config, missing


def delta(baseline, candidate, *, rate=False, comparable=True):
    if not comparable or baseline is None or candidate is None:
        return {"absolute_change": None, "percentage_change": None}
    difference = round(candidate - baseline, 6)
    return {"absolute_change": difference,
            "percentage_change": round(100 * (candidate - baseline) / baseline, 6) if not rate and baseline != 0 else None}


def summarize(rows):
    overview = calculate_overview(rows)

    def observed(values):
        known = [value for value in values if isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)]
        return {"value": median(known) if known else None, "samples": len(known),
                "job_ids": sorted(str(row["id"]) for row, value in zip(rows, values)
                                  if isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value))}

    metrics = {"runs": {"value": len(rows), "samples": len(rows)}}
    for phase in ("compilation", "execution"):
        stats = overview[phase]
        metrics[f"{phase}_completed"] = {"value": stats["completed"], "samples": len(rows)}
        metrics[f"{phase}_success"] = {"value": stats["rate_percent"], "samples": stats["completed"],
                                           "job_ids": sorted(str(row["id"]) for row in rows
                                                             if attempt(row, phase) in {"succeeded", "failed"})}
    metrics["compilation_duration"] = observed([
        interval(row.get("metadata") or {}, "compilation_started_at", "compilation_finished_at")
        if attempt(row, "compilation") in {"succeeded", "failed"} else None for row in rows])
    for key, source in (("queue_time", "queue_time"), ("execution_duration", "execution_duration")):
        contributors = [row for row in rows if interval(row.get("metadata") or {},
                        "queue_entered_at" if key == "queue_time" else "execution_started_at",
                        "execution_started_at" if key == "queue_time" else "execution_finished_at") is not None
                        and (key == "queue_time" or attempt(row, "execution") in {"succeeded", "failed"})]
        metrics[key] = {"value": overview[source]["median_seconds"], "samples": overview[source]["samples"],
                        "job_ids": sorted(str(row["id"]) for row in contributors)}
    for key in ("estimated_logical_qubits", "estimated_circuit_depth", "estimated_gate_count"):
        metrics[key] = observed([(row.get("metadata") or {}).get(key) for row in rows])
    return {"runs": len(rows), "compilation": overview["compilation"], "execution": overview["execution"],
            "metrics": metrics, "jobs": [{"id": str(row["id"]), "name": row["name"], "status": row["status"]}
                                         for row in sorted(rows, key=lambda row: str(row["id"]))]}


METRICS = (
    ("runs", "Runs", "jobs"), ("compilation_completed", "Completed compilation attempts", "attempts"),
    ("execution_completed", "Completed execution attempts", "attempts"),
    ("compilation_success", "Compilation success rate", "%"), ("execution_success", "Execution success rate", "%"),
    ("compilation_duration", "Median compilation duration", "s"), ("queue_time", "Median queue time", "s"),
    ("execution_duration", "Median execution duration", "s"),
    ("estimated_logical_qubits", "Median estimated logical qubits", "qubits"),
    ("estimated_circuit_depth", "Median estimated circuit depth", "layers"),
    ("estimated_gate_count", "Median estimated gate count", "gates"),
)


def compare_jobs(rows, baseline, candidate):
    logical_groups = defaultdict(list)
    selected = [row for row in rows if (row.get("metadata") or {}).get("compiler_version") in {baseline, candidate}]
    for row in selected:
        logical, config, missing = configuration(row)
        logical_groups[logical].append((row, config, missing))
    result = []
    for logical, members in sorted(logical_groups.items()):
        differing = [key for key in members[0][1] if len({canonical(config[key]) for _, config, _ in members}) > 1]
        variants = defaultdict(list)
        for row, config, missing in members:
            variants[canonical(config)].append((row, missing))
        for variant, group in sorted(variants.items()):
            left = [row for row, _ in group if row["metadata"]["compiler_version"] == baseline]
            right = [row for row, _ in group if row["metadata"]["compiler_version"] == candidate]
            missing = sorted({field for _, fields in group for field in fields})
            status = "unverifiable" if missing else "matched" if left and right else "baseline_only" if left else "candidate_only"
            sides = {"baseline": summarize(left), "candidate": summarize(right)}
            metrics = []
            for key, label, unit in METRICS:
                values = {side: summary["metrics"][key] for side, summary in sides.items()}
                metrics.append({"key": key, "label": label, "unit": unit, **values,
                                "delta_unit": "pp" if unit == "%" else unit,
                                **delta(values["baseline"]["value"], values["candidate"]["value"],
                                        rate=unit == "%", comparable=status == "matched")})
            result.append({"workload": logical, "configuration": json.loads(variant), "status": status,
                           "differences": differing, "missing_fields": missing, **sides, "metrics": metrics})
    return {"rows": result, "selected_jobs": len(selected), "excluded_version_jobs": len(rows) - len(selected),
            "matched_groups": sum(row["status"] == "matched" for row in result)}


router = APIRouter()


@router.get("/comparisons")
def get_comparison(request: Request, filters: Annotated[ComparisonFilters, Query()]):
    try:
        with request.app.state.engine.connect().execution_options(isolation_level="REPEATABLE READ") as connection:
            with connection.begin():
                options = cohort_options(connection)
                rows = connection.execute(select(jobs).where(
                    jobs.c.specification["experiment"]["id"].astext == str(filters.experiment))).mappings().all() if filters.experiment else []
                versions = sorted({row["metadata"].get("compiler_version") for row in rows if row["metadata"].get("compiler_version")})
                ready = bool(filters.experiment and filters.baseline and filters.candidate)
                return {"synthetic": True, "selection_required": not ready, "experiment_jobs": len(rows),
                        "experiments": options["experiments"], "compiler_versions": versions,
                        **(compare_jobs(rows, filters.baseline, filters.candidate) if ready else {
                            "rows": [], "selected_jobs": 0, "excluded_version_jobs": 0, "matched_groups": 0})}
    except SQLAlchemyError:
        raise HTTPException(status_code=503, detail="Comparisons are temporarily unavailable. Please try again.") from None
