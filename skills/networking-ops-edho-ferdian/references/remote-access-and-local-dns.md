# Networking Lens — Remote Access And Local DNS

This reference covers WireGuard remote access and local DNS/Pi-hole
together. The Pi-hole material is covered by concept only — its product-
specific surface (adlist URLs, `pihole -g`, admin-UI click paths) is
tool-locked and was deliberately not carried over. What survived is the
part that is true of any local resolver.

**Mode.** Use this reference when the design or change involves reaching a
private network or private host from outside it, or standing up a resolver
that the network then depends on — "how do I reach my VPS services without
exposing them", "set up WireGuard", "should this be split or full tunnel",
"we're moving DHCP clients onto a local resolver".

**Read-only default.** Everything here is planning and review. Generating
key material, opening a firewall port, or repointing a DHCP DNS option are
all changes — they go through the change-window discipline in
`config-review.md`, not through a diagnostic pass.

## Part 1 — Remote access (WireGuard-style)

### Decide reachability before generating a single key

The first question is never "how do I set up WireGuard", it is **what is
this tunnel allowed to reach**. Answer that first, because it decides the
peer `AllowedIPs`, the firewall policy, and whether the design is safe at
all.

| Mode | `AllowedIPs` on the client | Use when | Risk to name explicitly |
| --- | --- | --- | --- |
| Split tunnel, one subnet | `10.0.0.0/24` | Remote admin of one host group | Keep the route list narrow; widening it later is a policy change, not a config tweak |
| Split tunnel, several subnets | `192.168.10.0/24, 192.168.30.0/24` | Reaching several zones | Requires precise firewall rules per zone, or the tunnel silently becomes a trust bypass |
| Full tunnel | `0.0.0.0/0, ::/0` | Untrusted networks, travel | The server's upload bandwidth becomes the client's ceiling everywhere; the server also inherits DNS responsibility |
| Overlay mesh (Tailscale/ZeroTier-style) | n/a — managed | Simpler onboarding with identity controls | Still needs an ACL review; "it's on the overlay" is not authorization |

**Rule:** a VPN peer gets the *narrowest* route set that satisfies the
stated use case. "Give it the whole LAN so we don't have to think about
it" is the same anti-pattern as a wildcard firewall rule.

### Key hygiene — non-negotiable

- **One keypair per client device.** Sharing a keypair across a phone and a
  laptop breaks the security model outright: revoking one revokes both, and
  the peer identity no longer maps to a device.
- **Generate with a restrictive umask from the start**, never chmod after
  the fact — the window between creation and chmod is a real exposure:

  ```bash
  sudo sh -c 'umask 077; wg genkey > /etc/wireguard/server_private.key'
  sudo sh -c 'wg pubkey < /etc/wireguard/server_private.key > /etc/wireguard/server_public.key'
  sudo chmod 600 /etc/wireguard/wg0.conf
  ```

- **Private keys never enter version control, logs, exception messages, or
  chat.** They are password-equivalent. If a script generates them, it
  writes to mode-600 files and prints the *public* key only.
- **Peer revocation must be possible without rebuilding the network** —
  removing one `[Peer]` block and reloading. If revoking a device would
  require re-keying the server, the design is wrong.
- Rotate the server keypair on a schedule, and treat it as a coordinated
  change (every client config needs the new public key).

### Forwarding rules: scope them

The single most common real-world mistake in a WireGuard server config is a
blanket `FORWARD ACCEPT`. Scope by interface and direction instead:

```text
PostUp   = iptables -A FORWARD -i wg0 -o eth0 -j ACCEPT
PostUp   = iptables -A FORWARD -i eth0 -o wg0 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
PostUp   = iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = <the same three rules with -D instead of -A>
```

The return-path rule is `RELATED,ESTABLISHED` only — the tunnel initiates,
the LAN does not initiate back into it. Confirm the real outbound interface
name (`ip route show default`) rather than assuming `eth0`.

`net.ipv4.ip_forward=1` must be set (via `/etc/sysctl.d/`, so it survives
reboot) or the tunnel will establish and route nothing — a confusing
failure mode worth checking early.

### Before opening a port at the edge

Do not recommend port-forwarding or an inbound firewall allow until all of
these are confirmed:

- The VPN endpoint software is patched and actively maintained.
- The forwarded port reaches **the VPN service only** — never an admin UI,
  NAS console, hypervisor, or router panel.
- Public-IP behaviour is understood: static, dynamic (needs DDNS), or
  CGNAT (inbound will not work at all — the design needs an overlay or a
  relay instead).
- Peer keys can be revoked individually.
- Connection state is observable — who connected, when, last handshake.

If DDNS is used, its credentials live in a mode-600 env file, not inline in
a compose file or a cron line.

### Mobile clients

`PersistentKeepalive = 25` on any client behind NAT (i.e. every phone).
Without it the NAT mapping expires while idle and the tunnel appears to
"randomly stop working" — a symptom that wastes hours if the keepalive is
not checked first.

### Troubleshooting order

Handshake is the ground truth. `wg show` — if `latest handshake` is never
or stale, the tunnel is not up, and everything downstream is noise.

1. Is the UDP listen port actually reachable from outside (host firewall,
   edge firewall, cloud security group, CGNAT)?
2. Does the client's configured server public key match `wg show wg0
   public-key`? A copy/paste truncation here is common.
3. Is IP forwarding on (`cat /proc/sys/net/ipv4/ip_forward` → `1`)?
4. Does the client's `AllowedIPs` actually cover the destination? A client
   routing `192.168.1.0/24` will never reach `192.168.3.5`, and the failure
   looks like a firewall problem but is not one.
5. `dmesg | grep wireguard` for kernel-level errors.

Handshake up but no traffic ⇒ routing/forwarding/firewall. Handshake down
⇒ transport/keys. Do not debug both at once.

## Part 2 — Local DNS resolver

### A resolver is a dependency, not a feature

The moment a network's DHCP hands out a local resolver address, that
resolver is a hard dependency for every device on it. Design it that way:

1. **Reserved or static address first, resolver software second.** If the
   resolver's own address can change via DHCP, every client loses DNS when
   it does.
2. **Prove it resolves both directions before pointing anything at it** —
   a public name and a local name.
3. **Keep a documented fallback path** for the operator during rollout.
   Note the honest tradeoff: a public secondary resolver improves
   availability but *bypasses* whatever filtering the local resolver does,
   because clients query secondaries opportunistically, not only on
   failure. If strict filtering is the goal, the redundancy answer is a
   second local resolver, not a public one.
4. **Test one client or one zone before changing every DHCP scope.**
5. **Two DHCP servers on one L2 domain is a config error, not a
   redundancy strategy.** Disable the old one before enabling the new one.
6. **Document which networks are allowed to bypass the resolver, and why.**
   Blocking rules commonly break captive portals, corporate VPN clients,
   firmware update paths, and medical or security devices.

### Local naming

Use `home.arpa` (RFC 8375) for private names. Rationale, in order of
strength:

- `.local` is reserved for mDNS/Bonjour — using it in unicast DNS causes
  real, hard-to-diagnose resolution conflicts on macOS and iOS.
- `.lan`, `.home`, `.internal` and similar ad-hoc suffixes are widely used
  and mostly work, but they are not reserved — a future gTLD delegation or
  a resolver that forwards them upstream leaks internal names publicly.
- `home.arpa` is reserved for exactly this and never resolves publicly.

```text
nas.home.arpa
gateway.home.arpa
switch-01.home.arpa
```

### Encrypted upstream

If upstream privacy matters, terminate DNS-over-HTTPS locally (a small
proxy on `127.0.0.1:<port>`) and point the resolver at it, rather than
configuring DoH per client. Install the proxy from the vendor's signed
package repository; if a raw binary is unavoidable, pin an exact release
and verify its checksum before installing.

### Version pinning for long-lived DNS infrastructure

Never run a resolver container on a floating `latest` tag. DNS is the one
service whose unattended upgrade takes the entire network down with it, and
the failure mode (nothing resolves) removes the operator's ability to look
anything up while diagnosing. Pin an explicit release tag and upgrade
deliberately. See `container-ops-edho-ferdian` for the general image-tag
discipline; this is its highest-stakes instance.

### Validation evidence to require after any resolver change

```text
Client receives the expected DHCP lease
Client receives the expected resolver address (check the lease, not the assumption)
Public name resolves
Local home.arpa name resolves
A filtered test name is filtered only where intended
Resolver and gateway admin interfaces are NOT reachable from guest/IoT/untrusted zones
```

## Cross-references

- `config-review.md` — every change proposed here is a config change and
  gets that file's change-window discipline before it runs.
- `homelab-planning.md` — the readiness inventory and staged change
  sequence this file assumes has already happened.
- `security-review-edho-ferdian/references/domain-specific.md`
  (`CLOUD-SEC-03 Over-open network rules`) — the review-side counterpart
  when the endpoint is a cloud host with a provider firewall.
