# Networking Lens — Config Review

**Mode.** Use this reference when the user pastes or points at an existing
router/switch configuration (or a proposed change snippet for a maintenance
window) and wants it reviewed — "review konfigurasi Cisco ini", "cek ACL
ini aman nggak", "audit switch config", "is this config safe to push". This
is the most self-contained of the modes this skill consolidates:
it ships a real, evidence-based severity ladder rather than deferring to
skills this ecosystem doesn't have, so it gets the most depth here.

**Scope.** Cisco IOS and IOS-XE style running configuration: interface,
VLAN, ACL, VTY, AAA, SNMP, NTP, logging, routing, and banner blocks. Also
covers proposed change snippets meant to be pasted into a change window.
**Read-only review only** — never apply configuration, and never suggest a
live test that removes a protection to "see what breaks."

## Review workflow

1. Identify the device role, platform, and change intent if stated (e.g.
   "this is a core switch," "this is a new ACL for a change window tonight").
2. Parse configuration into sections: interfaces, routing, ACLs, line vty,
   AAA, SNMP, logging, NTP, banners.
3. If this is a proposed change, check the change snippet first, then pull
   in adjacent existing config only as needed to prove a finding (e.g. an
   ACL referenced by the new interface line must be checked against the
   ACLs actually defined elsewhere in the file).
4. Report only findings with enough evidence to act on — quote the actual
   line or block, don't paraphrase from memory of "what Cisco configs
   usually look like."
5. Separate hard blockers (Critical) from best-practice improvements
   (Medium/Low) so the reader knows what must change before a push versus
   what can wait.

## Severity ladder

### Critical — BLOCK

- Plaintext or default credentials (`password 0 <plaintext>`, vendor default
  passwords left in place, `username admin password admin`).
- `snmp-server community public` or `private` — especially with `RW` (write)
  access. This is the single most common real-world finding and should
  always be called out by name if present.
- Telnet-only management (`transport input telnet` with no `ssh` alternative)
  or internet-facing VTY access with no source-address restriction
  (`access-class` missing on `line vty`).
- Proposed destructive commands with no rollback context: `reload`, `erase`,
  `format`, a broad `no interface <range>`, or removing an entire routing
  process (`no router bgp <asn>`, `no router ospf <id>`) without a documented
  rollback plan.

### High — WARN, should fix before merge/push

- SSH v1 (`ip ssh version 1`), weak enable-password usage instead of
  `enable secret`, missing AAA (`aaa new-model` absent) where the
  environment's other config implies centralized auth is expected.
- **ACLs referenced by an interface or routing policy but never defined in
  the config.** This is a real operational trap: the interface applies
  `ip access-group 101 in`, but ACL 101 doesn't exist anywhere in the file —
  which on most platforms means the traffic is either silently permitted or
  the config will fail to apply, depending on platform behavior. Always grep
  every `access-group`, `access-class`, and route-map reference against the
  actual ACL/route-map definitions present.
- Route-maps, prefix-lists, or community-lists referenced by BGP/routing
  policy but not defined anywhere in the file (same "referenced but
  undefined" pattern as above, applied to routing policy objects).
- Subnet overlaps or duplicate interface IP addresses across the config.

### Medium — INFO, consider fixing

- No NTP configured, no timestamps on logging (`service timestamps log
  datetime`), no remote/syslog logging, or no evidence a config backup
  exists before a proposed change.
- Management-plane access (SSH, SNMP, HTTP(S) management) not restricted to
  a dedicated management subnet or VLAN.
- Missing `description` on important uplinks, trunks, or routed
  point-to-point links — small thing, but it's what makes the next
  troubleshooting session (see `troubleshooting-methodology.md`) fast
  instead of slow.

### Low — NOTE, optional

- Naming, comment, and documentation cleanup.
- Suggested monitoring additions that aren't required for the change itself
  to be safe (e.g. "consider adding an SNMP trap for interface flaps").

## Output format

Report in this shape — evidence-first, one block per finding:

```text
## Network Configuration Review: <hostname or "unknown device">

### Critical
[CRITICAL-1] <finding>
Section: <interface/ACL/VTY/SNMP/... block>
Evidence: <the actual config line or block, quoted>
Risk: <what breaks or is exposed if this ships as-is>
Fix: <safe remediation, or the change-window prerequisite needed first>

### High
[HIGH-1] ...

### Medium
[MEDIUM-1] ...

### Low
[LOW-1] ...

### Summary
| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |

Verdict: PASS | WARNING | BLOCK
Checked: <what sections/blocks were actually inspected>
Residual risk: <what couldn't be verified from the pasted config alone —
e.g. "cannot confirm ACL 101 is unused elsewhere without the full config">
```

**Verdict rule:** `BLOCK` for any Critical finding, or any proposed
destructive command with no rollback plan. `WARNING` for High/Medium
findings that don't block the maintenance window by themselves. `PASS`
only when there are zero actionable findings.

## Safety rules

- Never recommend removing an ACL, disabling a firewall rule, or opening
  VTY access as a way to "test" whether something is the cause of a problem
  — that is a diagnostic shortcut this skill explicitly refuses (see
  `troubleshooting-methodology.md` for the read-only alternative).
- Prefer read-only confirmation commands when asking the user to gather more
  evidence: `show running-config`, `show ip access-lists`, `show ip route`,
  `show logging`, `show interfaces`.
- If a command in scope changes device state, label it explicitly as a
  **proposed fix**, not a diagnostic step, and require a maintenance window,
  a rollback plan, and a verification step before treating it as ready to
  run.

## Not yet covered

This lens reviews *text* configuration for known-bad patterns and
referential integrity (things referenced but not defined). It does not:

- Automate the review via SSH/Netmiko against a live device by itself — the
  executable, bounded-automation form of this same checklist now lives in
  `automation-and-preflight.md`. Cross-reference note: if the two ever
  disagree on how severe a finding is, **this file (`config-review.md`) is
  authoritative on severity** — `automation-and-preflight.md` owns the
  mechanics of running the check safely against a live device, not the
  severity ladder itself.
- Validate BGP-specific policy correctness beyond "is this route-map/
  prefix-list defined" — deep BGP state diagnostics live in
  `interface-and-bgp-diagnostics.md` Part 2.
- Cover non-Cisco syntax (Juniper, Arista EOS, MikroTik, etc.) — the
  severity *concepts* here (default creds, world-readable SNMP, undefined
  ACL references, destructive commands without rollback) generalize, but
  the exact command syntax quoted above is Cisco IOS/IOS-XE specific.
