"""Zip a user's exported reports with the system zip tool."""
import subprocess
from pathlib import Path

EXPORTS = Path("/srv/exports")


def archive_exports(user_id: int) -> Path:
    folder = EXPORTS / str(int(user_id))
    dest = folder.with_suffix(".zip")
    subprocess.run(["zip", "-r", "-q", str(dest), "."], cwd=folder, check=True)
    return dest
