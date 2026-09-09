# Networking Lens — Vendor GUI Concepts (UniFi / pfSense-OPNsense / MikroTik)

**Accuracy caveat — read this before every section below.** Exact menu paths
and labels below reflect common conventions as of this writing and **WILL
drift** with firmware/software updates — verify against the actual installed
version's UI before executing any step, and prefer the platform's own
current documentation for exact navigation. This file organizes content by
**the concept being configured**, not by literal click path, because concept
names (e.g. "VLAN assignment happens per network/interface, then mapped to a
port profile or SSID") are far more stable across versions than a specific
menu position or button label. Where a concrete menu label is given below,
treat it as an illustrative example of current convention, not a guarantee.

**Mode.** Use this reference alongside `homelab-planning.md` and
`remote-access-and-local-dns.md` once the design is settled and the operator
is ready to actually execute it on real UniFi, pfSense/OPNsense, or
MikroTik gear. This file answers "where does this concept live in each
platform's UI," not "should I do this" (that's `design-principles.md` and
`homelab-planning.md`) or "is this proposed config safe" (that's
`config-review.md`, which every state-changing step below still goes
through).

## Before you touch anything

This repeats Rule zero from `homelab-planning.md` because it is the single
most important sentence in this file: the dominant failure mode of a
small-network change is not a security breach, it is **the operator locking
themselves out of their own gateway, switch, AP, or resolver** with no
console path back.

Before executing *any* step in this file:

- Confirm out-of-band or same-room console access exists for anything the
  change touches — management VLAN moves, trunk port changes, firewall
  default policy, DHCP scope, and resolver cutover, all of them. "Out-of-band"
  means a path that does not depend on the change succeeding: a direct
  console/serial cable, a laptop plugged into a known-good access port, or
  physical proximity to power-cycle the device — not "I'll just SSH back in
  from the network I'm about to change."
- Snapshot/export the current configuration (UniFi: controller backup;
  pfSense/OPNsense: `Diagnostics → Backup & Restore` or equivalent config
  export; MikroTik: `/export` or a binary backup) before making the change.
  This snapshot **is** the rollback plan referenced throughout
  `homelab-planning.md`'s staged change sequence.
- Test on one client/one port/one rule before rolling the change out
  network-wide, per the staged change sequence in `homelab-planning.md`.
- If a step below changes device state, it goes through
  `config-review.md`'s change-window discipline (backup, rollback plan,
  verification step) — it is a proposed fix, never a diagnostic shortcut.

## VLAN / network segmentation — where it conceptually lives

*(Accuracy caveat applies — see top of file.)*

**UniFi (Network application / Controller).** Segmentation is modeled as
**Networks**, each carrying a VLAN ID, subnet, and a "purpose" (routed vs.
isolated). Conceptual locations, current naming as of this writing:

- Network/VLAN definition: a **Networks** section under the site's settings
  — each network you create gets a VLAN ID, subnet/gateway, and DHCP
  behavior attached to it directly (there is no separate "create VLAN" step
  distinct from "create network" the way some other platforms split it).
- SSID-to-VLAN mapping: a **WiFi/Wireless Networks** section — each SSID has
  a "Network" field that binds it to one of the Networks defined above. This
  is the mechanism an AP uses to tag traffic per SSID onto the right VLAN.
- Per-port VLAN/trunk behavior on a managed switch: a **switch port
  profile** concept — each port gets a profile that declares it as an access
  port on one network, or a trunk carrying a defined set of tagged networks.
  Port profiles are typically reusable and assigned per-port, not configured
  one-off per port.
- Firewall/isolation rules between networks: a **traffic rules / firewall
  rules** section, generally organized by direction (LAN-to-LAN, WAN-in,
  etc.) with source/destination expressed as a Network rather than a raw
  CIDR when possible — prefer that over hand-typing subnets, since it stays
  correct if the subnet is ever renumbered.

**pfSense / OPNsense.** Segmentation is modeled as **VLAN interfaces**,
which is a two-step concept even though the wizard sometimes hides the
seam:

1. VLAN tag creation: a VLAN object binds a tag number to a parent physical
   (or LAGG) interface, under an **Interfaces → VLANs**-shaped area.
2. Interface assignment: the VLAN object is then assigned as its own logical
   interface (gets enabled, gets an IP, gets a name) under an
   **Interfaces → Assignments**-shaped area — this second step is easy to
   forget and is why "I created the VLAN but it doesn't route" is a common
   beginner symptom.
3. DHCP per segment: DHCP service is configured **per interface**, so each
   VLAN's DHCP scope lives under that VLAN's own DHCP settings page, not one
   central DHCP screen.
4. Firewall rules: rules are configured **per interface, evaluated
   top-to-bottom, first match wins** — a rule lives under the tab for the
   interface (VLAN) it applies to, and ordering within that tab is the
   entire policy. This is the same "narrow allow above broad block" rule
   from `homelab-planning.md`'s segmentation-mistakes list — a DNS allow
   rule to a resolver must sit above a general RFC1918 block rule on the
   same interface, or it never gets evaluated.

**MikroTik (RouterOS — WinBox and WebFig both surface the same underlying
concepts, just via different UI shells).** Segmentation is modeled around a
**VLAN-filtering bridge**:

- Bridge with VLAN filtering: one bridge object with VLAN filtering enabled
  is the conceptual hub — physical ports are added as bridge ports, then
  each bridge port is declared tagged or untagged for specific VLAN IDs.
- Per-port VLAN membership: each bridge port gets a PVID (the untagged/access
  VLAN it belongs to) and a frame-types setting that determines whether it
  accepts tagged traffic, untagged traffic, or both — this is the RouterOS
  equivalent of "access port" vs. "trunk port."
- VLAN-to-subnet binding: a separate VLAN interface object sits on top of
  the bridge for each VLAN ID and is what actually gets an IP address —
  the bridge port config controls switching behavior, the VLAN interface
  controls routing/addressing.
- DHCP: DHCP pools and DHCP servers are separate objects, each bound to one
  VLAN interface.
- Firewall: filtering happens in a firewall filter chain (commonly the
  `forward` chain for inter-VLAN traffic), matched top-to-bottom like the
  pfSense/OPNsense model — rule order is again the entire policy.
- WinBox vs. WebFig: both present the same underlying RouterOS object model
  (bridge, bridge port, VLAN interface, firewall filter) — WinBox is the
  native Windows/Wine GUI, WebFig is the browser-based equivalent served by
  the router itself. Menu tree shape differs cosmetically between them and
  across RouterOS versions; the object model described above is the stable
  part.

Across all three platforms, the trunk-vs-access concept from
`homelab-planning.md` holds without translation: a trunk port carries
several VLANs tagged (switch↔router, switch↔switch, switch↔AP); an access
port carries exactly one VLAN untagged (switch↔end device). An AP serving
multiple SSIDs always needs a trunk, because the AP is what applies the
per-SSID tag before frames reach the switch.

## DNS / DHCP — where it conceptually lives, and how Pi-hole integrates

*(Accuracy caveat applies — see top of file.)*

**UniFi.** DHCP is configured per-Network (see above) — each Network has a
DHCP enable/range setting and a **DNS Server** field. To integrate a local
resolver such as Pi-hole: set that field to the resolver's (static/reserved)
address instead of the gateway's own DNS proxy, per network that should use
it. There is generally no separate DNS-forwarding config needed on the
UniFi side for this — it is just "which DNS server does DHCP hand out."

**pfSense / OPNsense.** Two independent-but-related concepts:

- The router's own resolver (Unbound-based on both platforms, under a
  **DNS Resolver**-shaped settings area) can itself be configured to forward
  specific domains or all queries to an upstream resolver — this is where
  "conditional forwarding" (send `home.arpa` queries one place, everything
  else another) is configured if the router itself is the point of
  integration.
- To make Pi-hole the actual resolver clients use: either point each
  interface's DHCP "DNS Servers" option at the Pi-hole's static address
  directly (simplest), or configure the router's own DNS Resolver to forward
  to Pi-hole as its upstream. The first approach is more common and easier
  to reason about — it means Pi-hole sees every client query directly rather
  than only the router's forwarded queries.
- DHCP DNS option lives per-interface, same location as the DHCP scope
  itself (see segmentation section above).

**MikroTik.** DNS on RouterOS is a single global **DNS** settings object
(not per-VLAN) with its own set of upstream servers and an "allow remote
requests" toggle that must be enabled for the router to act as a resolver
for LAN clients at all. To integrate Pi-hole:

- Point each VLAN's DHCP server's DNS option at Pi-hole's address directly
  (in the DHCP network object, alongside the gateway setting) — this is the
  same pattern as the other two platforms and is the most common approach.
- Alternatively, set the router's own DNS upstream to Pi-hole and rely on
  the router's DNS proxy — this only works well if `allow-remote-requests`
  is enabled and clients are actually pointed at the router for DNS (via
  DHCP) rather than at Pi-hole directly.

**General Pi-hole integration pattern that holds regardless of platform**
(from ECC `homelab-pihole-dns`, generalized per `remote-access-and-local-dns.md`):
Pi-hole sits as an upstream/conditional-forward target, not as a DHCP
server, on any network where the platform's own DHCP is already trusted —
running Pi-hole's own DHCP is a separate decision that requires disabling
the platform's DHCP on that segment first, never running both
simultaneously on one L2 domain. Give Pi-hole a static IP or a DHCP
reservation before pointing anything at it — its own address must never
move. A public secondary resolver (e.g. `1.1.1.1`) improves availability
during rollout but bypasses Pi-hole's filtering, since clients query
secondaries opportunistically, not only on failure; for strict filtering,
add a second Pi-hole instead.

## Firewall rule / policy — where it conceptually lives, and ordering per platform

*(Accuracy caveat applies — see top of file.)*

**UniFi.** Rules are grouped by direction/zone (LAN-local, WAN-in, guest,
etc.) in a **Traffic Rules / Firewall Rules**-shaped area, generally with a
simpler default posture than pfSense/OPNsense (UniFi's "Traffic Rules"
layer sits above a more advanced legacy firewall-rules layer on some
versions — if both exist on the installed version, check which one is
actually being evaluated before assuming a rule took effect). Prefer
expressing rules in terms of Networks/zones rather than raw CIDRs so they
survive a later re-addressing.

**pfSense / OPNsense.** Rules are per-interface, top-to-bottom, first match
wins — this is the single most important operational fact about this
platform's firewall. A narrow allow (e.g. "IoT → Pi-hole, port 53") must be
placed **above** a broader block rule on the same interface tab, or it is
dead configuration that never gets evaluated. There is no cross-interface
single rule list to reorder — each interface tab has its own independent
top-to-bottom order.

**MikroTik.** Rules live in firewall filter chains (`input`, `forward`,
`output` being the three built-in ones; inter-VLAN traffic is almost always
matched in `forward`), evaluated top-to-bottom within each chain, first
match wins — same ordering discipline as pfSense/OPNsense, different UI
shell. `add place-before=<rule-number>` (CLI) or the equivalent
"move up/down" control (WinBox/WebFig) is how a narrow allow gets inserted
above a broad block after the fact.

The rule-ordering discipline from `homelab-planning.md`'s segmentation
mistakes ("a narrow allow must sit above the broad block, or it is dead
config") applies identically to all three platforms — only the mechanism
for expressing and reordering rules differs.

## Provenance

- **ECC `homelab-vlan-segmentation`** (fetched 2026-09-09, from
  `github.com/affaan-m/ECC`): source for the UniFi Networks/WiFi/Traffic
  Rules conceptual shape, the pfSense/OPNsense VLAN-creation-then-interface-
  assignment two-step, the pfSense/OPNsense per-interface top-to-bottom rule
  ordering example, and the MikroTik VLAN-filtering-bridge object model
  (bridge → bridge port → VLAN interface → firewall filter chain) including
  the illustrative `/interface bridge`, `/interface bridge port`,
  `/interface bridge vlan`, `/interface vlan`, and `/ip firewall filter`
  command shapes. The concrete menu-path strings in that source (e.g.
  "Settings → Networks → Create New Network") are reproduced here only as
  illustrative examples of current convention, per the accuracy caveat at
  the top of this file — they are not re-verified against a live install.
- **ECC `homelab-pihole-dns`** (fetched 2026-09-09, from the same
  repository): source for the Pi-hole-as-upstream integration pattern (DHCP
  DNS option pointed at Pi-hole vs. router-forwards-to-Pi-hole), the
  static-IP-before-install requirement, the "don't run two DHCP servers on
  one L2 domain" rule, and the public-secondary-resolver-bypasses-filtering
  tradeoff. Pi-hole's own product-specific admin-UI click paths (Adlists,
  Query Log, `pihole -g`) were not re-ported here — they were already
  generalized in `remote-access-and-local-dns.md` and restating them
  per-vendor would not add anything, since Pi-hole is a single product, not
  three.
- **General platform knowledge beyond the ECC sources**: the UniFi
  Networks-vs-legacy-firewall-rules distinction, the pfSense/OPNsense
  Unbound-based DNS Resolver and its conditional-forwarding capability, the
  MikroTik global (non-per-VLAN) DNS object and its
  `allow-remote-requests` toggle, the WinBox-vs-WebFig relationship
  (same RouterOS object model, different UI shell), and the MikroTik
  `place-before` rule-reordering mechanism came from general knowledge of
  these platforms rather than the two ECC sources above — flagged here
  because, per the accuracy caveat, UI specifics on any platform drift
  over time and general knowledge is no more immune to staleness than the
  ECC source material is.
