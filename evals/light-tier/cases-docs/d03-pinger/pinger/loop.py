import time

import httpx

from pinger.config import load_config


def run() -> None:
    cfg = load_config()
    while True:
        for target in cfg["targets"]:
            r = httpx.get(target["url"], timeout=10)
            if r.status_code != target["expect_status"]:
                httpx.post(cfg["webhook"], json={"url": target["url"], "status": r.status_code})
        time.sleep(60)
