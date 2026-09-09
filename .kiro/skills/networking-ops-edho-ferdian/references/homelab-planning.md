# Networking Lens — Homelab And Small-Network Planning

This reference covers homelab and small-network setup/readiness together
with the vendor-neutral half of VLAN segmentation planning. The vendor
configuration walkthroughs (UniFi Controller, pfSense/OPNsense, MikroTik)
are covered separately, conceptually rather than as literal click-paths —
see the "Vendor GUI concepts" section at the end.

**Mode.** Use this reference alongside `design-principles.md` when the
target is a home, small-lab, or single-operator network — consumer or
prosumer gear, one person with physical access, no change-advisory board.
`design-principles.md` decides the topology; this file decides whether the
operator can survive executing it.

**Register check.** If this is a team-operated network with an uptime
obligation, this is the wrong file — use the enterprise register in
`design-principles.md` instead.

## Rule zero: keep the operator reachable

The dominant failure mode of a small-network change is not a security
breach. It is **the operator locking themselves out of their own gateway,
switch, AP, or resolver** and having no console path back. Every
recommendation below exists to prevent that.

Before proposing any step, confirm out-of-band or same-room console access
exists for anything the change touches — management VLAN moves, trunk port
changes, firewall default policy, DHCP scope, and resolver cutover, all of
them.

## Required inventory — collect before giving any implementation step

Refusing to answer until this is filled in is correct behaviour, not
unhelpfulness. A plan written without it will be wrong in a way that costs
the operator their remote access.

| Area | Questions |
| --- | --- |
| Internet edge | Modem or ONT? Is the upstream router bridged or still routing (double NAT)? |
| Gateway | What actually routes, firewalls, serves DHCP, and terminates VPN? |
| Switching | Which ports are uplinks, access, trunks, or on unmanaged gear? |
| Wi-Fi | Which SSIDs map to which networks? Are APs wired or wireless-backhaul? |
| Addressing | Which subnets exist today, and do any collide with VPN or remote-site ranges? |
| DNS / DHCP | Which service hands out leases and resolver addresses right now? |
| Management | How does the operator reach gateway, switch, and AP *after* the change? |
| Recovery | What can be reverted locally, physically, if DNS/DHCP/VLAN/VPN breaks? |

## Address plan

**Avoid `192.168.0.0/24` and `192.168.1.0/24` on any network you will
ever VPN into.** They are the default on hotel, café, office, and ISP
routers worldwide; a split tunnel into an overlapping range routes nowhere
and the failure looks like a VPN bug. Pick something unlikely.

```text
Example plan (adapt the numbers, keep the shape):

  10.20.10.0/24   trusted clients
  10.20.20.0/24   IoT / untrusted appliances
  10.20.30.0/24   servers and storage
  10.20.40.0/24   guest
  10.20.99.0/24   network management

Per-subnet conventions:
  .1          gateway
  .2 – .49    infrastructure reservations
  .50 – .240  dynamic DHCP pool
  .241 – .254 spare
```

Apply the same convention to **every** subnet. The consistency is the
point: it makes an address readable without a lookup, which is what makes
the next incident fast.

**DHCP reservations for anything you SSH into, bookmark, monitor, back up,
or expose as a service.** A dynamic address on a NAS, resolver, or
automation host is a scheduled outage waiting for a lease renewal.

## Trust zones

Design in terms of trust intent first; VLAN IDs and vendor syntax come
last.

| Zone | Typical contents | Default policy |
| --- | --- | --- |
| Trusted | Admin workstations, personal laptops, phones | Reaches shared services; reaches management only from named devices |
| Servers | Storage, automation hosts, resolver, self-hosted apps | Accepts narrow inbound flows from trusted; initiates outbound as required |
| IoT / appliances | TVs, plugs, cameras, speakers, printers | Internet plus explicit exceptions only |
| Guest | Visitor devices | Internet only; no reachability to any local zone, and ideally isolated from each other |
| Management | Gateway, switch, AP, controller web UIs | Reachable only from named trusted admin devices |
| Remote (VPN) | Remote clients | Same as trusted or narrower — never broader |

Before committing to VLAN IDs, verify each of these — a design the hardware
cannot run is worse than no design:

1. Does the gateway do inter-VLAN routing **and** firewall rules between
   them?
2. Does the switch do the required tagged/untagged port behaviour?
3. Can the APs map SSID → VLAN?
4. Which port is the operator connected through *during* the change?
5. Does management stay reachable after the trunk and SSID changes land?

If the answer to 1–3 is no, say so plainly and propose a staged hardware
upgrade path. Do not describe a design the operator's actual box cannot
execute.

## Trunk vs access — the concept that has to be right

```text
Trunk port  — carries several VLANs, tagged.
              switch↔router, switch↔switch, switch↔AP.
Access port — carries exactly one VLAN, untagged.
              switch↔end device (PC, camera, NAS — it never knows VLANs exist).
```

An AP serving multiple SSIDs needs a **trunk**, because the AP is what
applies the per-SSID tag. Wiring an AP to an access port and wondering why
only one SSID works is a top-three beginner symptom.

## The four segmentation mistakes worth naming every time

1. **Creating VLANs without firewall rules.** Inter-VLAN routing is open by
   default on most gateways. VLANs alone are an addressing change, not a
   security control. The isolation rules are the deliverable; the VLANs are
   just the prerequisite.
2. **Native VLAN equals management VLAN.** Untagged traffic landing in the
   management VLAN is a VLAN-hopping path. Use a dedicated, otherwise
   unused VLAN as native and keep management tagged.
3. **Resolver placed in the untrusted zone.** Put a shared resolver in the
   servers zone and add one explicit DNS allow rule from each zone that
   needs it. In the IoT zone it is reachable by exactly the devices you
   trust least and unreachable by the ones you trust most.
4. **Rule ordering.** On first-match-wins firewalls, a narrow allow (e.g.
   "IoT → resolver, port 53") must sit **above** the broad private-range
   block, or it is dead config. Always state where a new rule goes, not
   just what it says.

Also: never reuse one Wi-Fi password across a trusted SSID and an
appliance SSID. The password is the segment boundary for wireless devices.

## Staged change sequence

Small and reversible, always in this order:

1. Snapshot current topology, address plan, DHCP scopes, resolver settings,
   and firewall rules. This snapshot **is** the rollback plan.
2. Reserve infrastructure addresses (gateway, resolver, controller, APs,
   storage, VPN endpoint) before anything moves.
3. Create the new zone/VLAN **without moving anything into it**.
4. Move one test client. Validate DHCP lease, resolver, routing, internet,
   and the isolation you intended — including a negative test: from the
   restricted zone, an attempt to reach a trusted host must fail.
5. Add narrow firewall exceptions for the flows that actually broke.
6. Move one low-risk device group.
7. Add remote access last, with the narrowest routes and policy that
   satisfies the use case (see `remote-access-and-local-dns.md`).
8. Document the final state, the exceptions and why each exists, and the
   rollback steps in the platform's own vocabulary.

Steps 3–5 are the whole method. A design that cannot be validated on one
client before rollout has no validation gate at all.

## Review checklist

- Every network has a stated reason to exist and a clear trust boundary.
- No management interface is reachable from guest, appliance, or public
  internet.
- Resolver failure does not remove the operator's ability to recover.
- DHCP scope changes were proven on one client first.
- Remote clients receive only the routes and resolver settings they need.
- Inter-zone policy is default-deny with named, dated exceptions.
- The operator can still reach gateway, switch, AP, resolver, and VPN
  admin surfaces — verified, not assumed.
- Rollback is written down in the same UI/CLI vocabulary the operator will
  be using under stress.

## Anti-patterns

- Segmenting before knowing which ports and SSIDs carry which VLANs.
- Moving the admin workstation off the only reachable management path.
- Repointing every DHCP scope at a new resolver before testing fallback.
- Publishing storage, resolver, gateway, or hypervisor management directly
  to the internet.
- Treating remote-access clients as equivalent to trusted LAN clients.
- Adding a temporary allow-all rule and never removing it — if a temporary
  rule is genuinely needed, it gets an expiry date in its comment.
- Double NAT with no reason and no documentation.
- Consumer routers reused as APs with their DHCP servers still enabled.
- Copying commands from a different vendor or firmware version without
  checking the exact platform syntax.

## Vendor GUI concepts

Where the VLAN, DNS/DHCP, and firewall concepts above conceptually live in
UniFi (Network application/Controller), pfSense/OPNsense, and MikroTik
(WinBox/WebFig) is covered in `references/vendor-gui-concepts.md` — organized
by concept (e.g. "VLAN assignment happens per-port under the switch/port
profile section") rather than by literal menu navigation, because concept
names stay stable across firmware/software updates while exact click-paths
and button labels do not. That file carries an explicit caveat on every
section: verify against the actual installed version's UI before executing
any step, and prefer the platform's own current documentation for exact
navigation. It does not claim to have exact, current click-paths, and it
should not be treated as a substitute for the platform's own docs — it is a
map of where to look, not a script to follow verbatim.
