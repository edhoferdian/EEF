# Networking Lens — Interface And BGP Diagnostics

Adapted from ECC `network-interface-health` and `network-bgp-diagnostics`,
both fetched 2026-09-04. Merged because they are the same discipline at two
layers: read state, interpret it against a reference table, and never reset
or reconfigure as a diagnostic step.

**Mode.** Depth for `troubleshooting-methodology.md` — that file decides
which layer to start at, this file is what you do once you are there. Part
1 backs its L1/L2 section; Part 2 backs its L3 section for BGP.

**Read-only.** Everything here reads state. Anything that changes state is
a remediation step and goes to `config-review.md`'s change-window
discipline.

## Part 1 — Interface health

### The trend is the evidence, not the number

A counter's absolute value says nothing — it may have accumulated over two
years of uptime. **Capture a baseline, wait a measured interval, capture
again, compare the increments.** And never clear counters before recording
the baseline: clearing destroys the only evidence of whether the fault is
active or historical.

```text
show interfaces <interface>
show interfaces <interface> status
show logging | include <interface>|changed state|line protocol
```

On Linux hosts: `ip -s link show <if>`, `ethtool <if>`, `ethtool -S <if>`.

### Counter reference

| Counter | Meaning | Usual cause |
| --- | --- | --- |
| CRC | Received frame checksum failed | Bad cable, dirty fibre, failing optic, duplex mismatch |
| input errors | Aggregate receive-side errors | Read the sub-counters before concluding anything |
| runts | Frames below minimum Ethernet size | Duplex mismatch, collision domain, faulty NIC |
| giants | Frames larger than expected MTU | MTU mismatch or jumbo-frame boundary |
| input drops | Device could not accept inbound packets | Burst, oversubscription, CPU punt path, queue pressure |
| output drops | Egress queue discarded packets | Congestion, QoS policy, undersized uplink |
| resets | Interface hardware reset | Flapping, keepalive, driver, optic, power |
| collisions | Ethernet collision counter | Half duplex or negotiation mismatch |

### Diagnosis flows

**CRCs or input errors.** Confirm they are incrementing. Then check **both
ends** of the link — receive-side errors indicate what arrived on that
side, which usually implicates the *other* end's transmitter or the medium
between, not the port doing the reporting. Replace patch cable or clean and
replace optics before touching routing or firewall config. Verify
speed/duplex matches on both sides. Correlate against flap timestamps in
the log.

**Drops.** Separate input from output drops first — they have unrelated
causes. Compare interface rate against link capacity. Check queue counters
and QoS policy. Prove congestion before tuning queues; queue tuning applied
to a non-congested link just moves the symptom.

**Duplex and speed.** Prefer auto-negotiation where both ends support it.
If one side must be fixed, fix **both** explicitly and document why. Fixed
on one side with auto on the other is the classic silent-degradation
config: the link comes up, and performance is mysteriously terrible.

**"Internet is slow but the LAN is fine."** Check WAN interface
errors/drops → LAN uplink utilisation and output drops → gateway CPU if the
WAN link is clean → compare a wired and a wireless test before blaming the
upstream provider.

### Anti-patterns

- Clearing counters before saving a baseline.
- Looking at only one side of a link.
- Treating historical CRCs as an active problem without a time window.
- Mixing auto-negotiation with a fixed setting across a link.
- Calling output drops a cable problem before checking congestion.

## Part 2 — BGP diagnostics

### Triage order

1. Identify the exact neighbour, **address family, VRF**, and local/remote
   ASNs. Do not assume global IPv4 unicast.
2. Capture summary state and the last reset reason.
3. Prove reachability to the peer's source address.
4. Check route policy references **before** concluding transport failure.
5. Compare advertised / received / installed routes where the platform
   supports it.

```text
show bgp summary                     show ip prefix-list
show bgp neighbors <peer>            show route-map
show ip route <peer>                 show running-config | section router bgp
show tcp brief | include <peer>|:179
show logging | include BGP|<peer>
```

### State interpretation

| State | What to check first |
| --- | --- |
| Established, with a prefix count | Exchange is working — inspect policy and table selection, not transport |
| Established, zero prefixes | Inbound policy, max-prefix limit, what the peer advertises, AFI/SAFI mismatch |
| Active | TCP is not completing — routing, update-source, ACLs, peer reachability |
| Connect | TCP in progress — path and remote listener |
| OpenSent / OpenConfirm | TCP works — ASN mismatch, authentication, timers, capabilities, logs |
| Idle | Disabled, missing config, blocked by policy, or in backoff |

If the peer is sourced from a loopback, confirm **both directions** route
to the loopbacks and that the neighbour config uses the expected
update-source. This is the most common "Active forever" cause and it is
invisible from one side.

### AS-path regex

Use token boundaries. `_65001_` matches AS 65001 as a token; a bare `65001`
also matches longer ASNs containing that digit sequence and unrelated text.
A wrong regex here produces a confidently wrong answer.

### Change-window only — never offered as a diagnostic step

- Clearing a BGP session (and if a reset is approved, prefer the least
  disruptive soft/route-refresh option the platform supports, with a
  written reason why it is safe).
- Changing neighbour authentication, timers, update-source, route-maps, or
  prefix-lists.
- Enabling additional received-route storage — this reconfigures the peer
  relationship, and doing it mid-incident changes the thing being measured.
- Relaxing firewall, ACL, or control-plane policy.

### Anti-patterns

- Assuming `Active` means the remote side is down.
- Ignoring VRF, address family, or update-source differences.
- Broad AS-path regex without token boundaries.
- Hard-resetting a peer before reading the last reset reason and the logs.
- Treating absent `received-routes` output as proof no routes arrived — on
  many platforms that output requires configuration that simply is not on.
