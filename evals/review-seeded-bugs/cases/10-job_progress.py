from dataclasses import dataclass


@dataclass(frozen=True)
class Job:
    id: str
    total_items: int
    done_items: int


def progress_percent(job: Job) -> int:
    """Percentage of the job completed, 0-100, for the progress bar."""
    if job.total_items <= 0:
        return 100
    percent = job.done_items // job.total_items * 100
    return max(0, min(100, percent))


def summarize(jobs: list[Job]) -> str:
    lines = [f"{j.id}: {progress_percent(j)}%" for j in jobs]
    return "\n".join(lines)
