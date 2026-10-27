import json
from pathlib import Path

SETTINGS = json.loads((Path(__file__).parent / "settings.json").read_text(encoding="utf-8"))


def retry_limit() -> int:
    return SETTINGS["retry_limit"]
