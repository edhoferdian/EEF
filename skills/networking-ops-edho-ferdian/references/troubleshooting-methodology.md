# Networking Lens — Troubleshooting Methodology

Adapted from ECC `network-troubleshooter`, fetched 2026-09-04.

**Mode.** Use this reference when the user is diagnosing a live network
symptom — "kenapa internet lambat", "site X can't reach site Y", "DNS
resolution fails but ping works", "BGP neighbor is flapping", "this VLAN
can't reach the gateway". This is a **read-only diagnostic workflow**: never
apply a configuration change while diagnosing, and never remove a
protection (ACL, firewall rule, auth) "just to test."

**What generalizes without device-specific automation.** The exact `show`/
`dig` commands below are illustrative and Cisco/Linux-flavored, but the
real value here — the **layer-by-layer methodology and what to check at
each layer** — generalizes to any vendor or platform. Device-specific
command automation (Netmiko-driven live queries, vendor-specific parsing)
now lives in `automation-and-preflight.md`; this file gives you the
diagnostic *logic*, which is vendor-independent and stands on its own
whether or not that automation is used to gather the evidence.

## Step 1 — characterize the symptom before touching a layer

Always answer these before picking a starting layer:

- **What fails?** (total outage, intermittent, slow, one direction only)
- **Who is affected?** (one host, one VLAN, one site, everyone)
- **When did it start?** (exact time helps correlate with a change)
- **What changed recently?** (a config push, a physical move, an ISP
  event, a firmware update) — this is often the fastest path to root cause
  and should be asked for explicitly if not already given.

## Step 2 — OSI-layer-by-layer workflow

Pick a starting layer based on the symptom, then work up or down as
evidence requires. Don't jump straight to "it's probably DNS" — prove it.

### Layer 1 & 2 — Physical / Data Link

Use for link-down, packet loss, CRC errors, and VLAN mismatch symptoms.

**Check:**
- Interface/port status — is it actually up/up, or down/down, or
  up/down (line protocol down despite physical link)?
- Error counters — CRCs, input/output errors, collisions increasing over
  time (not just a static snapshot).
- Duplex/speed mismatch between the two ends of a link.
- VLAN assignment — is the port on the access VLAN it's supposed to be on?
- Trunk VLAN allowed-list — is the VLAN actually permitted across the trunk
  the traffic needs to cross?
- Spanning-tree state — is the port stuck in blocking when it should be
  forwarding?

Illustrative commands (Cisco-flavored, adapt to platform):
```text
show interfaces <interface> status
show interfaces <interface>
show vlan brief
show spanning-tree vlan <id>
```

Depth: `interface-and-bgp-diagnostics.md` Part 1 (counter reference table,
diagnosis flows for CRC/errors/drops/duplex).

### Layer 3 — Network

Use for gateway, routing, and reachability symptoms.

**Check:**
- Is there a connected route for the subnet in question? A missing
  connected route usually means an interface is down or misconfigured, not
  a routing-protocol problem.
- Is the next hop correct, or pointing somewhere stale?
- Asymmetric routing — does traffic leave one path and return another,
  breaking stateful inspection somewhere in the middle?
- Is the default route pointing at the right upstream?

Illustrative commands:
```text
show ip interface brief
show ip route <destination>
ping <destination> source <interface-or-ip>
traceroute <destination> source <interface-or-ip>
```

Depth: `interface-and-bgp-diagnostics.md` Part 2 (BGP state interpretation,
triage order, AS-path regex pitfalls).

### Layer 3.5 — DNS

Use when IP connectivity works (ping by IP succeeds) but name resolution
fails — this is the classic "the network is fine, DNS is the villain"
pattern.

**Check:**
- Does a known-good public resolver succeed where the local resolver fails?
  If yes, the problem is the local resolver, the DHCP-advertised DNS option,
  a firewall rule blocking UDP/TCP 53, or a local zone misconfiguration —
  not the network path itself.
- Is the client actually using the resolver you think it's using (check the
  DHCP lease / resolv.conf / adapter settings, don't assume)?

Illustrative commands:
```text
dig @<local-dns> <name>
dig @<known-good-resolver> <name>
nslookup <name> <local-dns>
```

### Layer 4/7 — Policy and Firewall

Use read-only counters and logs to test whether a policy is the cause.
**Never disable the policy to test** — that's a diagnostic shortcut this
methodology explicitly forbids, because it trades a fast (but risky) answer
for a real security gap, even temporarily.

**Check:**
- Does a deny counter on the suspected ACL/firewall rule increment when the
  failing flow is attempted? If yes, that's your evidence — propose a
  narrow allow rule for exactly that flow, not a broad opening.
- Do the actual source/destination/port values in the failing flow match
  what the policy was written to allow? (A surprising number of "the
  firewall is broken" reports are actually "the policy was written for the
  wrong subnet/port.")

Illustrative commands:
```text
show ip access-lists <name>
show running-config interface <interface>
show logging | include <interface>|ACL|DENY|DROP
```

## Step 3 — confirm before concluding

Before writing up a root cause, confirm the suspected cause actually
explains **all** the observed symptoms — not just the first one checked. A
cause that explains 80% of the symptom but leaves one detail unexplained
(e.g. "why does it only fail for these three users and not the other two on
the same VLAN?") usually means the diagnosis is incomplete, not that the
remaining detail is unrelated noise.

## Output format

```text
## Diagnosis: <one-line likely root cause>

Symptom: <reported failure>
Affected scope: <host, VLAN, subnet, site, or unknown>
Layer: <where the fault was found — L1/2, L3, DNS, or policy>

Evidence:
- `<command>` -> <what it proved>
- `<command>` -> <what it ruled out>

Root cause:
<specific explanation — not a vague "network issue">

Recommended fix:
1. <safe action or config change to schedule>
2. <rollback or maintenance-window note if relevant>

Verification:
- `<command>` should show <expected result after the fix>

Residual risk:
<what still needs device access, logs, or timing evidence you don't have>
```

## Guardrails

- Prefer evidence over guesses — every claim in the root-cause section
  should trace back to something in the Evidence list.
- Never recommend temporarily removing ACLs, firewall rules, authentication,
  or management-plane restrictions as a way to isolate a cause. If a policy
  is the suspected cause, use counters/logs (Layer 4/7 section above)
  instead of disabling it.
- If a command needed to move forward changes device state (not just reads
  it), label it explicitly as a **remediation step**, not a diagnostic
  command, and hand it to `config-review.md`'s change-window discipline
  before it's run.

## Not yet covered

This file gives the layer-by-layer methodology a human runs manually or
feeds to whatever access they already have — it does not itself walk
through device-specific command output. Automated, bounded evidence
collection (SSH-driven bulk `show` command execution, structured log
parsing per vendor) now lives in `automation-and-preflight.md` Stage 2 —
use that reference when the evidence-gathering step itself needs to be
scripted rather than run by hand.
