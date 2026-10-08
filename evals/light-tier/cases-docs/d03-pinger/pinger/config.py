from pathlib import Path

import yaml

CONFIG_PATH = Path("conf/app.yaml")


def load_config() -> dict:
    data = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))
    for target in data["targets"]:
        target.setdefault("expect_status", 200)
    return data
