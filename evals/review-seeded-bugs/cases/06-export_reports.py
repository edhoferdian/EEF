import csv
from pathlib import Path


def export_reports(reports: list[dict], out_dir: Path) -> list[Path]:
    """Write one CSV per report; skip reports that have no rows."""
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for report in reports:
        rows = report.get("rows") or []
        path = out_dir / f"{report['slug']}.csv"
        handle = open(path, "w", newline="", encoding="utf-8")
        if not rows:
            continue
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
        handle.close()
        written.append(path)
    return written
