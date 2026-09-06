# Networking Lens — Device Commands And Change Windows

Adapted from ECC `cisco-ios-patterns`, fetched 2026-09-04. Cisco IOS /
IOS-XE flavoured; the *discipline* generalises to any vendor, the exact
syntax does not.

**Mode.** Use when reading, writing, or reviewing device-level
configuration syntax, choosing read-only commands to gather evidence, or
building the before/after checklist for a maintenance window.

**Treat every example as a pattern, never a paste-ready change.** Confirm
platform, interface naming, current state, rollback path, and out-of-band
access before anything runs on a real device.

## Change-window workflow

1. Capture current state with read-only commands.
2. Review the exact candidate config (see `automation-and-preflight.md` for
   the automated form).
3. Confirm management access cannot be locked out.
4. Apply the smallest change inside the window.
5. Re-read state, diff against the baseline.
6. **Only then** persist to startup config.

## Running vs startup config — the distinction that causes outages

`running-config` is active memory. `startup-config` is what survives a
reload. **Do not persist a change just because the device accepted the
command** — acceptance means syntax parsed, not that behaviour is correct.
Validate first, persist second. The gap between them is the free rollback:
a bad change that was never saved is undone by a power cycle.

## Wildcard masks — the single highest-value item in this file

IOS ACLs and several routing statements take **wildcard** masks, not subnet
masks. Substituting one for the other produces config that applies cleanly
and matches vastly more traffic than intended — a silent, high-blast-radius
failure with no error message.

| Subnet mask | Wildcard mask |
| --- | --- |
| 255.255.255.255 | 0.0.0.0 |
| 255.255.255.252 | 0.0.0.3 |
| 255.255.255.0 | 0.0.0.255 |
| 255.255.0.0 | 0.0.255.255 |

Check every wildcard mask in a candidate ACL against this table before the
change is approved. Add it to the preflight list in
`automation-and-preflight.md` as a manual step where a regex cannot infer
intent.

## Implicit deny

Every IOS ACL ends in an implicit `deny ip any any` that is invisible in
the config. When observing misses matters operationally, add an explicit
logged deny — after confirming the resulting log volume is safe:

```text
ip access-list extended WEB-IN
  10 permit tcp 192.0.2.0 0.0.0.255 any eq 443
  999 deny ip any any log
```

## ACL placement — questions to answer before applying

- Which direction is being filtered, `in` or `out`?
- Is management traffic sourced from a known jump host or management
  subnet, and does the ACL permit it?
- Is there an explicit permit for required routing, DNS, time sync,
  monitoring, and application traffic?
- Are hit counters observable from a safe test source?
- Is there a rollback command **and** an active console/out-of-band path?

## Read-only evidence collection

Collect the specific section rather than dumping a full config into a
ticket — full configs carry secrets, customer names, and topology.

```text
show version                         show ip interface brief
show inventory                       show interfaces
show processes cpu sorted            show interfaces status
show memory statistics               show vlan brief
show logging                         show mac address-table
show running-config | section line vty
show running-config | section interface
show running-config | section router bgp
show ip route                        show ip access-lists
show ip protocols                    show route-map
                                     show ip prefix-list
```

## Interface hygiene

```text
interface GigabitEthernet0/1
 description UPLINK-TO-CORE
 switchport mode trunk
 switchport trunk allowed vlan 10,20,30
 switchport trunk native vlan 999
 no shutdown
```

Explicit description, explicit mode, explicit allowed-VLAN list, and a
dedicated unused native VLAN. On routed interfaces, confirm mask, peer
addressing, and routing process before assuming link-up means forwarding
is correct. The missing-description finding in `config-review.md`'s Medium
tier is what this prevents.

## Before/after verification — match the check to the change

```text
show running-config | section interface <interface>
show interfaces <interface>
show logging | include <interface>|changed state|line protocol
show ip route <prefix>
show ip access-lists <name>
```

Routing changes: capture neighbour state and route tables on both sides of
the window. ACL changes: compare hit counters from a *planned* test source
— a generic ping proves nothing about a policy written for specific
source/destination/port values.

## Anti-patterns

- Applying generated config without a device-specific diff.
- Saving configuration before post-change checks pass.
- Using a subnet mask where a wildcard mask is expected.
- Applying an ACL in the wrong direction.
- Troubleshooting by disabling ACLs, route policies, or authentication —
  refused ecosystem-wide, see the shared safety rules in `SKILL.md`.
- Pasting full configs into public tools without sanitising secrets and
  topology.
