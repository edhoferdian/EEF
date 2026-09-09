# Networking Lens — Design Principles

**Mode.** Use this reference when the user wants to design or plan a new
network, or extend an existing one — "rancang jaringan untuk homelab saya",
"design network segmentation for this office", "how should I VLAN this",
"plan redundancy for this site", "what's the right topology for N sites".

**Honesty about this file's origin.** The design-planning material here was
originally paired with thin routing logic: most of the real diagnostic and
automation depth lived elsewhere and was only deferred to, not actually
present. All of that depth has since been ported natively into this
skill's own reference set — see `interface-and-bgp-diagnostics.md`
(interface health + BGP), `automation-and-preflight.md` (Netmiko-style SSH
automation and preflight checks), `device-command-and-change-window.md`
(Cisco IOS command patterns and change-window discipline),
`homelab-planning.md` (homelab setup/readiness), and
`remote-access-and-local-dns.md` (remote access and local DNS) — none of it
depends on any external install anymore (per D-005). What follows in this
file is the genuine design-principle content — segmentation logic,
redundancy/failover basics, and the home-lab-vs-enterprise scope split —
which stands on its own and is complemented, not blocked, by the five
reference files above.

## Scope split: homelab vs. enterprise/multi-site

Pick the register based on what the user is actually building — the
constraints are genuinely different, not just a matter of scale:

| | Homelab / small-lab | Enterprise / multi-site |
| --- | --- | --- |
| Hardware assumption | Consumer/prosumer gear, don't assume VLAN or advanced-firewall capability exists | Assume managed switching, routing, and a real management plane |
| Primary risk | Locking the operator out of their own network (no console access, no second admin) | Scale, compliance scope, uptime SLAs, coordinated multi-site cutover |
| Planning output | Staged, reversible steps; explain terms on first use if operator is a beginner | Phased implementation plan with validation gates, aimed at an operator who already knows the vocabulary |
| Typical topology | Flat-to-lightly-segmented (guest/IoT isolation as the main "VLAN" need) | Routed boundaries per zone (management/server/user/guest/IoT-OT/regulated) |

If you don't know which register applies, ask: is this one operator with
physical access to all the hardware, or a team managing something other
people depend on being up? That answer decides which half of this file to
lean on.

## Segmentation and VLAN principles

These apply at both scales, just with different stakes:

- **Explicit segmentation by trust/function**, not by convenience: separate
  management, server/production, user, guest, and IoT/OT traffic into their
  own broadcast domains. In a homelab this might be as simple as "IoT VLAN +
  guest VLAN + everything else"; in an enterprise design it's a full zone
  table (see the Addressing And Segmentation table below).
- **Prefer routed boundaries over stretched layer-2 designs** unless a
  specific workload requirement proves otherwise (e.g. a cluster that
  genuinely needs L2 adjacency across sites). Default to "route between
  zones," not "one big flat VLAN that spans everything and hope firewall
  rules do the isolation."
- **Management plane gets its own segment.** Whatever else is designed,
  SSH/HTTPS/SNMP management access should sit on a dedicated management
  subnet or VLAN, not mixed into user or server traffic — this is also the
  #1 thing `config-review.md`'s Medium-severity findings check for after
  the fact.
- **Don't assume the hardware supports it.** For homelab designs
  specifically: if the gateway/switch/AP can't do VLANs, local DNS, or safe
  remote access, say so plainly and propose a staged hardware upgrade path
  rather than describing a design the operator's actual box can't run.

## Redundancy and failover basics

- Redundancy is a design decision made **after** the topology and
  segmentation are chosen, not bolted on afterward — decide the routing
  boundaries first, then decide where failover matters.
- Don't assume BGP, OSPF, EVPN, or SD-WAN are required by default. Pick the
  simplest design that satisfies the actual scale, operational skill level,
  and risk tolerance in front of you — a single small office rarely needs a
  dynamic routing protocol; a multi-site WAN usually does.
- Treat the **management plane, logging, and config backup** as part of the
  redundancy story, not an afterthought: if the primary path to a device
  goes down, how does the operator still reach it? If a config push goes
  wrong, is there a saved-config rollback point?
- For any change that could lock operators/admins out (a VLAN migration, a
  DNS resolver cutover, a firewall re-segmentation), require: console or
  out-of-band access, a config backup, a defined maintenance window, and an
  explicit rollback step — **before** recommending the change, not as an
  afterthought if something goes wrong.

## Workflow (both registers)

1. Restate the objective, constraints, and non-goals (or, for homelab:
   inventory the hardware and confirm the goals — isolation, guest Wi-Fi,
   local services, remote access, monitoring, learning, family reliability).
2. Identify what's missing that would materially change the design: site
   count, user/device count, critical applications, compliance scope,
   uptime target, existing hardware, budget tier, cutover tolerance (or for
   homelab: does the hardware actually support the goal, or does it need a
   staged upgrade first).
3. Pick the topology and segmentation, and say why it fits the constraints
   — routing/segmentation comes before hardware model discussion.
4. Define the management plane, logging, monitoring, backup, and rollback
   model.
5. Produce a phased/staged implementation plan with a validation gate (or
   rollback point) at each step — smallest useful step first, optional
   phases later.
6. List residual risks and what evidence is still needed from the operator.

## Output format

```text
## Network Design: <project, home, or environment name>

### Objective
<what this design is for>

### Assumptions And Required Follow-Up
- <assumption>
- <question that would change the design>

### Capability Check (homelab register only)
| Goal | Supported by current hardware? | Requirement or upgrade needed |
| --- | --- | --- |

### Recommended Topology
<topology choice and the reasoning behind it>

### Addressing And Segmentation
| Zone / network | Purpose | Routing boundary | Example range | Allowed flows |
| --- | --- | --- | --- | --- |

### DNS, DHCP, And Local Services (if applicable)
<resolver plan, static reservations, fallback path, service placement>

### Management, Observability, And Backup
<management access, logging, config backup, monitoring, alerting>

### Implementation Phases
1. <phase, with a validation gate>
2. <phase, with a rollback point>

### Risks And Mitigations
| Risk | Impact | Mitigation |
| --- | --- | --- |
```

Naming exact hardware models is only appropriate once the user has already
supplied a vendor or procurement standard — otherwise recommend capacity
classes, redundancy needs, port counts, and feature requirements instead.

## Not yet covered

This file is design principles and topology-level thinking only. It
deliberately does **not** cover the following — not because the depth is
missing, but because it belongs in a more specific reference:

- Device-specific command syntax (Cisco IOS/IOS-XE, Juniper, MikroTik, etc.)
  for actually applying a design — see `device-command-and-change-window.md`.
- BGP-specific neighbor/route-policy diagnostics and interface-health
  counter analysis — see `interface-and-bgp-diagnostics.md` (Part 1 for
  interfaces, Part 2 for BGP).
- Bounded SSH automation (Netmiko-style) and pre-change evidence gathering —
  see `automation-and-preflight.md`.
- Homelab hardware readiness and staged setup detail beyond the scope-split
  table above — see `homelab-planning.md`.
- Remote access and local DNS design specifics — see
  `remote-access-and-local-dns.md`.
- Deep layer-by-layer live troubleshooting of an already-built network —
  that is `troubleshooting-methodology.md`'s job, not this file's.
