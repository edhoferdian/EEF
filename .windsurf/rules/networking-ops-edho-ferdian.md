---
trigger: model_decision
description: "Networking skill covering five modes — config review, network design (homelab or enterprise/multi-site), read-only OSI-layer diagnosis, device operations/change windows (Cisco IOS-flavoured), and homelab build-out (see the Mode detection table below for the full breakdown and which mode fits). Use whenever the user pastes a config to review (\"cek config Cisco ini\"), wants a network designed (\"rancang jaringan homelab\"), is troubleshooting connectivity/DNS/routing symptoms (\"kenapa internet lambat\"), needs to script a device change (\"push this ACL via SSH\"), or is building a homelab. Consolidates config review, design, troubleshooting, device automation, and homelab build-out into one skill."
---

# Networking Ops — Edho Ferdian Mode

## Provenance

This skill consolidates what used to be several separate, narrower
capabilities — config review, network design (homelab and
enterprise/multi-site), read-only troubleshooting, and device
operations/automation — into one skill (the same consolidation pattern used
by `language-code-review-edho-ferdian` for the language-reviewer family),
building real substance where real substance existed in the source material
rather than leaving thin pass-through routing between pieces.

The device-operations and homelab-build-out material folds in coverage for
Cisco IOS command patterns, Netmiko-based SSH automation, config
validation, interface/BGP diagnostics, homelab network setup and
readiness, VLAN segmentation, WireGuard remote access, and Pi-hole/local
DNS. Most of that material carried over in full. Two areas were folded only
partially: the VLAN-segmentation and Pi-hole/local-DNS material each
originally included a vendor-UI / product-specific walkthrough section
(UniFi controller screens, Pi-hole's web admin clickpath) that was
dropped — this skill can't verify a specific product's current UI and
shouldn't fake having tested it. The underlying concepts (segmentation
boundaries, DNS-sinkhole architecture, upstream/conditional-forwarding
design) were kept and generalized.

## Honest scope statement — read this first

**Coverage is real but has a specific shape, not a universal one.**
Device-command syntax, change-window discipline, automation scripting, and
diagnostic command output in this skill are Cisco IOS/IOS-XE flavoured —
that's what the source material (`cisco-ios-patterns`,
`netmiko-ssh-automation`, the BGP/interface diagnostics sources) actually
covers in concrete syntax. Other vendors (Juniper Junos, Arista EOS,
MikroTik RouterOS) get the underlying concepts — what a change window is
for, why preflight validation matters, how to read interface/BGP state in
general — but not their native command syntax. Translate the concept, don't
assume the Cisco command works verbatim elsewhere.

**Covered conceptually, with an explicit accuracy caveat:** where VLAN
segmentation, DNS/DHCP integration (including Pi-hole), and firewall
rule/policy configuration conceptually live in UniFi, pfSense/OPNsense, and
MikroTik (WinBox/WebFig) — see `references/vendor-gui-concepts.md`. That
file deliberately does not claim exact, current click-paths or menu labels
(those go stale with firmware/software updates and cannot be verified
without the hardware in hand); it documents the stable conceptual location
and naming of each setting instead, with a prominent caveat on every section
to verify against the actual installed version before executing.

## Mode detection

Pick the mode from what the user is actually asking for. State which mode
you're in before loading the reference file, the same way
`language-code-review-edho-ferdian` states which stack lens it loaded.

| Signal | Mode | Load |
| --- | --- | --- |
| User pastes an existing config, or a proposed change snippet, and wants it reviewed/audited/checked before a push | **Config review** | `references/config-review.md` |
| User wants to design a new network, re-segment an existing one, plan VLANs/redundancy/topology, homelab or enterprise/multi-site | **Design** | `references/design-principles.md` |
| User describes a live symptom — can't connect, DNS fails, slow, BGP flapping, VLAN unreachable — and wants a root cause | **Troubleshooting** | `references/troubleshooting-methodology.md` |
| User wants to run, script, or push a device command/change — SSH into a device, automate a change across multiple devices, needs a maintenance-window plan for a live push | **Device operations / automation** | `references/device-command-and-change-window.md` + `references/automation-and-preflight.md` |
| User is building or expanding a homelab or small network — remote access setup, local DNS, readiness check before buying/racking gear | **Homelab / small-network build** | `references/homelab-planning.md` + `references/remote-access-and-local-dns.md` |

If the request spans more than one mode (e.g. "diagnose why this failed,
then fix the config"), run them in sequence: troubleshooting first to find
the root cause, then config-review on the proposed fix before it ships.
Never skip config-review on a fix just because troubleshooting already
found the cause — a fix is a config change and gets reviewed like one.
Likewise, "automate this change across 40 switches via SSH" is not an
edge case — it's the device operations/automation mode above: load
`device-command-and-change-window.md` for the change-window discipline and
`automation-and-preflight.md` for the scripting and validation approach.

If a request still doesn't clearly match any of the five modes, say so
plainly rather than forcing a best-effort fit into the closest one.

## Shared safety rules (all five modes)

These are consistent across all modes of this skill and
apply regardless of which reference file is active:

- **Never recommend removing an ACL, firewall rule, or auth control as a
  troubleshooting or testing shortcut.** This isn't mode-specific — it's a
  hard rule.
- **Never present a config change as a diagnostic step.** If a command
  changes device state, label it a proposed fix requiring a maintenance
  window, backup, and rollback plan — not something to run "just to see."
  This is a hard blocker in `config-review.md`'s severity ladder for
  destructive commands with no rollback context.
- **Read-only by default.** Config review, design, and troubleshooting are
  planning/review/diagnosis and never apply configuration directly. Device
  operations/automation is the only mode that can touch live device state,
  and only behind the explicit-flag rule below.
- **Don't recommend exposing a management interface to the internet**, in
  any mode — design, review, or troubleshooting.
- **Automation defaults to read-only**; a config-changing code path
  requires an explicit operator flag, and persisting to startup config is
  always a separate, later, approved step.

## Language routing (fixed — see skill-authoring-edho-ferdian's canonical contract)

Communication to the user in Bahasa Indonesia; device configs, commands,
and scripts in English — fixed, never ask. Full contract:
`skill-authoring-edho-ferdian` §7.

## Reference files

| File | Mode |
| --- | --- |
| `references/config-review.md` | Config review — the most self-contained source, ported with the most depth (full severity ladder, output format, verdict rule) |
| `references/design-principles.md` | Design — homelab and enterprise/multi-site registers, segmentation/VLAN principles, redundancy basics |
| `references/troubleshooting-methodology.md` | Troubleshooting — OSI layer-by-layer methodology (L1/2 → L3 → DNS → policy), generalizes even without device-specific command syntax |
| `references/device-command-and-change-window.md` | Device operations — Cisco IOS/IOS-XE command discipline, maintenance-window planning, backup/rollback requirements before any state-changing command |
| `references/interface-and-bgp-diagnostics.md` | Troubleshooting / device operations — reading interface counters and BGP neighbor/route state to ground a diagnosis in real device output |
| `references/automation-and-preflight.md` | Device operations — Netmiko-driven SSH automation patterns and the preflight validation checks that must pass before any scripted change runs |
| `references/homelab-planning.md` | Homelab build — small-network planning and hardware/readiness assessment before buying or racking gear |
| `references/remote-access-and-local-dns.md` | Homelab build — WireGuard-style remote access design and local DNS (sinkhole/conditional-forwarding) architecture, vendor-UI-agnostic |
| `references/vendor-gui-concepts.md` | Homelab build — where VLAN, DNS/DHCP, and firewall configuration conceptually live in UniFi, pfSense/OPNsense, and MikroTik, with a prominent staleness caveat on every section |
