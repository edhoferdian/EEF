# Networking Lens — Automation And Config Preflight

Adapted from ECC `netmiko-ssh-automation` and `network-config-validation`,
both fetched 2026-09-04. The two are merged because they are the same
thing at two stages: validate the candidate config in code, then move it to
the device in code — with the same fail-closed posture on both sides.

**Mode.** Use this reference when code — not a human at a terminal — is
going to read from or write to network devices: an audit script, a
pre-flight gate in a pipeline, a bulk `show` collector, or a review of
someone else's automation before it touches production.

**Relationship to `config-review.md`.** That file is the *manual* review
ladder, and it stays authoritative on severity. This file is its
*executable* form: the same findings, expressed as checks that can run
unattended. When they disagree, `config-review.md` wins — regex is a
warning generator, not a device parser.

## Non-negotiable posture

- **Read-only is the default code path.** Collection needs no flag; change
  needs an explicit one.
- **Explicit inventory only.** Never sweep a CIDR range. The inventory is a
  reviewed list, kept out of the repo.
- **Credentials from environment, vault, or an interactive prompt.** Never
  in source, never in logs, never in an exception message or a traceback.
- **Every network call gets a timeout.** Connection, auth, banner, and
  per-command read. A hung SSH session in a batch job is an outage of the
  job, not a slow success.
- **Bounded concurrency.** Older devices and centralised auth systems fall
  over well before a modern thread pool does.
- **Per-device failure isolation.** One unreachable device must not abort
  the batch or lose the results already collected.
- **Saving config is a separate, later, approved step** from pushing it —
  never the same call, never the same flag.

## Stage 1 — Preflight validation (before anything connects)

Validate in this order; the ordering is the point, because the first two
categories are fail-closed and the rest are warn-only.

1. Destructive commands — **fail closed**.
2. Credential and management-plane exposure — **fail closed**.
3. Duplicate addresses and overlapping subnets — fail closed if inside the
   change scope, warn otherwise.
4. Stale references (ACLs, route-maps, prefix-lists, interfaces referenced
   but never defined) — warn, escalate to fail if the reference is in the
   change itself.
5. Operational hygiene (time sync, log timestamps, remote logging,
   banners) — warn only; these are usually outside the change's scope and
   blocking on them trains people to bypass the gate.

### Destructive-command detection

```python
import re

DANGEROUS_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\breload\b", re.I), "reload causes downtime"),
    (re.compile(r"\berase\s+(startup|nvram|flash)", re.I), "erases persistent storage"),
    (re.compile(r"\bformat\b", re.I), "formats a device filesystem"),
    (re.compile(r"\bno\s+router\s+(bgp|ospf|eigrp)\b", re.I), "removes a routing process"),
    (re.compile(r"\bno\s+interface\s+\S+", re.I), "removes interface configuration"),
    (re.compile(r"\baaa\s+new-model\b", re.I), "changes authentication behaviour"),
    (re.compile(r"\bcrypto\s+key\s+(zeroize|generate)\b", re.I), "changes device SSH keys"),
]

def find_dangerous_commands(lines: list[str]) -> list[dict[str, str | int]]:
    findings = []
    for line_number, line in enumerate(lines, start=1):
        stripped = line.strip()
        for pattern, reason in DANGEROUS_PATTERNS:
            if pattern.search(stripped):
                findings.append({"line": line_number, "command": stripped, "reason": reason})
    return findings
```

A hit here is not automatically a rejection — it is a **required human
acknowledgement**, with a rollback plan and an out-of-band access
confirmation recorded before the run proceeds. That is exactly the
`config-review.md` BLOCK rule, mechanised.

### Duplicate addresses and subnet overlaps

Use the stdlib rather than string comparison — `ipaddress` catches the
overlaps that eyeballing misses (a /23 quietly containing two planned /24s).

```python
import ipaddress
import re
from collections import Counter

IP_ADDRESS_RE = re.compile(
    r"^\s*ip address\s+"
    r"(?P<ip>\d{1,3}(?:\.\d{1,3}){3})\s+"
    r"(?P<mask>\d{1,3}(?:\.\d{1,3}){3})\b",
    re.I | re.M,
)

def extract_interfaces(config: str) -> list[dict[str, str]]:
    results, current = [], None
    for line in config.splitlines():
        if line.startswith("interface "):
            current = line.split(maxsplit=1)[1]
            continue
        match = IP_ADDRESS_RE.match(line)
        if current and match:
            network = ipaddress.ip_interface(
                f"{match.group('ip')}/{match.group('mask')}"
            ).network
            results.append({
                "interface": current,
                "ip": match.group("ip"),
                "network": str(network),
            })
    return results

def find_duplicate_ips(config: str) -> list[str]:
    counts = Counter(entry["ip"] for entry in extract_interfaces(config))
    return sorted(ip for ip, count in counts.items() if count > 1)

def find_subnet_overlaps(config: str) -> list[tuple[str, str]]:
    networks = [ipaddress.ip_network(e["network"]) for e in extract_interfaces(config)]
    return [
        (str(left), str(right))
        for index, left in enumerate(networks)
        for right in networks[index + 1:]
        if left.overlaps(right)
    ]
```

### Management-plane checks — parse by block, not by line

The classic bug in config-linting scripts: a regex written to check one
`line vty` block silently matches something twenty lines later in an
unrelated section, and the check reports a pass that was never true.
**Slice into blocks first, then match inside a block.**

```python
def iter_blocks(config: str, starts_with: str) -> list[str]:
    blocks: list[str] = []
    current: list[str] = []
    for line in config.splitlines():
        if line.startswith(starts_with):
            if current:
                blocks.append("\n".join(current))
            current = [line]
            continue
        if current:
            if line and not line.startswith(" "):   # dedent ends the block
                blocks.append("\n".join(current))
                current = []
            else:
                current.append(line)
    if current:
        blocks.append("\n".join(current))
    return blocks

def check_vty_blocks(config: str) -> list[str]:
    issues = []
    for block in iter_blocks(config, "line vty"):
        if re.search(r"transport\s+input\s+.*telnet", block, re.I):
            issues.append("VTY allows Telnet; require SSH only.")
        if not re.search(r"\baccess-class\s+\S+\s+in\b", block, re.I):
            issues.append("VTY block has no inbound access-class source restriction.")
        if not re.search(r"\bexec-timeout\s+\d+\s+\d+\b", block, re.I):
            issues.append("VTY block has no explicit exec-timeout.")
    return issues
```

The same block-slicing discipline applies to interface blocks, routing
process blocks, and anything else with a dedent-terminated structure.

### Security hygiene patterns

```python
SECURITY_PATTERNS = [
    (re.compile(r"\bsnmp-server community\s+(public|private)\b", re.I),
     "default SNMP community configured"),
    (re.compile(r"\bsnmp-server community\s+\S+", re.I),
     "SNMPv2 community string configured; prefer SNMPv3 authPriv"),
    (re.compile(r"\bip ssh version 1\b", re.I), "SSH version 1 enabled"),
    (re.compile(r"\benable password\b", re.I),
     "enable password present; use enable secret"),
    (re.compile(r"\busername\s+\S+\s+password\b", re.I),
     "local username uses password instead of secret"),
]

BEST_PRACTICE_PATTERNS = [
    (re.compile(r"\bntp server\b", re.I), "NTP server"),
    (re.compile(r"\bservice timestamps\b", re.I), "log timestamps"),
    (re.compile(r"\blogging\s+\S+", re.I), "logging destination or buffer"),
    (re.compile(r"\bsnmp-server group\s+\S+\s+v3\s+priv\b", re.I), "SNMPv3 authPriv group"),
    (re.compile(r"\bbanner\s+(login|motd)\b", re.I), "login banner"),
]
```

Presence patterns produce findings; absence patterns produce warnings. Keep
them in separate lists — conflating "found something bad" with "didn't find
something good" makes the report unreadable.

## Stage 2 — Read-only collection over SSH

```python
import os
from getpass import getpass
from netmiko import ConnectHandler
from netmiko.exceptions import (
    NetmikoAuthenticationException,
    NetmikoTimeoutException,
    ReadTimeout,
)

device = {
    "device_type": "cisco_ios",
    "host": "192.0.2.10",                       # documentation range in examples
    "username": os.environ.get("NETMIKO_USERNAME") or input("Username: "),
    "password": os.environ.get("NETMIKO_PASSWORD") or getpass("Password: "),
    "secret":   os.environ.get("NETMIKO_ENABLE_SECRET"),
    "conn_timeout": 10,
    "auth_timeout": 20,
    "banner_timeout": 15,
    "read_timeout_override": 30,
}

try:
    with ConnectHandler(**device) as conn:
        if device.get("secret") and not conn.check_enable_mode():
            conn.enable()
        print(conn.send_command("show ip interface brief", read_timeout=30))
except NetmikoAuthenticationException:
    print("Authentication failed")          # never echo the credential
except NetmikoTimeoutException:
    print("SSH connection timed out")
except ReadTimeout:
    print("Command read timed out")
```

Note what the handlers do **not** do: print the device dict, log the
password, or re-raise with credentials in the message.

### Batch collection

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

def collect_show(device: dict[str, Any], command: str) -> dict[str, Any]:
    host = device["host"]
    try:
        with ConnectHandler(**device) as conn:
            return {"host": host, "ok": True, "output": conn.send_command(command, read_timeout=45)}
    except (NetmikoAuthenticationException, NetmikoTimeoutException, ReadTimeout) as exc:
        return {"host": host, "ok": False, "error": type(exc).__name__}

results = []
with ThreadPoolExecutor(max_workers=8) as pool:
    futures = [pool.submit(collect_show, d, "show version") for d in devices]
    for future in as_completed(futures):
        results.append(future.result())
```

Every device returns a result object; nothing raises out of the worker.
Keep `max_workers` low until the estate and the auth backend are proven to
tolerate more.

### Structured parsing is an optimisation, never the only evidence

```python
parsed = conn.send_command(
    "show ip interface brief",
    use_textfsm=True,
    raise_parsing_error=False,
    read_timeout=30,
)
if isinstance(parsed, str):
    ...  # no template matched — keep the raw output for review
```

If parsed output drives a blocking decision, **store the raw output beside
it**. Parser success is not proof the device state is what you think; it is
proof a template matched the text.

## Stage 3 — Guarded change

```python
apply_changes = os.environ.get("APPLY_NETWORK_CHANGES") == "1"

if not apply_changes:
    print("Dry run only. Candidate commands:")
    print("\n".join(commands))
else:
    with ConnectHandler(**device) as conn:
        conn.enable()
        before = conn.send_command("show running-config interface GigabitEthernet0/1")
        output = conn.send_config_set(commands)
        after  = conn.send_command("show running-config interface GigabitEthernet0/1")
        # before / output / after go into the change record.
        # Saving to startup config is a SEPARATE, later, approved step.
```

Before/after capture is not logging — it is the evidence the change record
requires, and it is what makes the rollback decision possible five minutes
later. `save_config()` never appears in the same block.

## Review checklist for someone else's automation

- Is there an explicit, reviewed inventory source — not a range, not a
  discovery sweep?
- Are credentials absent from source, logs, and exception text?
- Are `conn_timeout`, `auth_timeout`, and per-command `read_timeout` all
  set?
- Does a single device failure produce a result rather than aborting the
  batch?
- Is concurrency bounded to something the estate and auth backend tolerate?
- Are config changes behind a dry-run default plus an explicit operator
  flag?
- Is saving to startup config separated from the push and tied to
  verification?
- Are before/after captures retained for the change record?
- Does the script sanitise output before writing anywhere shared?

## Anti-patterns

- Treating regex validation as a device parser, or a passing lint as
  approval.
- Sending config as the default code path.
- Running against a CIDR range instead of a reviewed inventory.
- Hardcoded passwords, enable secrets, or private keys.
- Logging full running-configs to shared systems without sanitisation —
  they carry secrets, customer names, and topology.
- Treating parser success as proof of device state.
- Recommending SNMPv2 community strings as a monitoring prerequisite.
- Applying generated config with no device-specific diff.
