# Worked Troubleshoot — "internet lambat" in a homelab, layer by layer

A read-only diagnosis following `troubleshooting-methodology.md`, with the
commands at each layer and how each result narrows the cause. Then one
change done properly through the change window. Commands are Linux /
Windows; adapt to the devices present.

## The report

"Sejak kemarin internet di rumah lambat, terutama sore. Kadang YouTube
buffering, kadang website gak kebuka sama sekali."

## Layer 1–2 — link and local network

```bash
# Linux
ip -s link show eth0                         # errors / drops counters
ethtool eth0 | grep -E "Speed|Duplex"        # 100Mb/Half on a gigabit cable = bad cable/port
iw dev wlan0 link                            # signal (dBm) and tx bitrate on Wi-Fi
# Windows
netsh wlan show interfaces
Get-NetAdapter | Select Name, LinkSpeed, Status
```

Result: laptop on Wi-Fi, signal −74 dBm, tx rate 39 Mbit/s → weak but not
the whole story (wired desktop is slow too).

## Layer 3 — reach the gateway, then beyond

```bash
ping -c 50 192.168.1.1          # LAN gateway: expect <2 ms, 0% loss
ping -c 50 1.1.1.1              # beyond the ISP
mtr -rwc 100 1.1.1.1            # Windows: pathping 1.1.1.1
```

```text
gateway  0% loss, avg 1.2 ms
1.1.1.1  6% loss, avg 48 ms, spikes to 900 ms
mtr: loss starts at hop 2 (ISP's first router) and carries through
```

Loss beginning at the first ISP hop and persisting to the destination →
problem at or before the ISP edge, not in the LAN.

## Is it our upload saturating the line? (bufferbloat)

```bash
# loaded latency: run a speed test while pinging
ping 1.1.1.1 &   # watch latency jump during the upload part of a speed test
```

Latency rises from 20 ms to 600 ms only while uploading → the router
queue fills (bufferbloat), usually from a device backing up to the cloud.
Router traffic page shows the NAS uploading at full line rate every
afternoon (the "sore" pattern).

## Layer 7 — DNS ("website gak kebuka")

```bash
dig +stats example.com @192.168.1.1        # local resolver
dig +stats example.com @1.1.1.1            # bypass it
nslookup example.com 192.168.1.1           # Windows
```

```text
@192.168.1.1  Query time: 2100 msec  (sometimes SERVFAIL)
@1.1.1.1      Query time: 14 msec
```

The router's DNS forwarder points at an ISP resolver that times out.

## Findings

| # | Layer | Finding | Evidence |
|---|---|---|---|
| 1 | 7 | Router forwards DNS to a slow/failing ISP resolver | 2.1 s vs 14 ms; SERVFAILs |
| 2 | 3/QoS | Upload saturation from NAS backup causes bufferbloat | latency 20 → 600 ms under upload |
| 3 | 1 | Weak Wi-Fi in the bedroom | −74 dBm |
| 4 | ISP | 6% loss from hop 2 | mtr 100 cycles — report to the ISP with this output |

## The change (one at a time, with rollback)

Change 1 — DNS forwarders on the router (example: OpenWrt):

```bash
# before: record current state
uci show dhcp | grep server > /root/dns-before.txt
# change
uci delete dhcp.@dnsmasq[0].server
uci add_list dhcp.@dnsmasq[0].server='1.1.1.1'
uci add_list dhcp.@dnsmasq[0].server='8.8.8.8'
uci commit dhcp && /etc/init.d/dnsmasq restart
# verify
dig +stats example.com @192.168.1.1
# rollback: restore servers listed in /root/dns-before.txt and restart dnsmasq
```

Change 2 — SQM (smart queue) to remove bufferbloat: set shaper to ~90 %
of measured line rates (`luci-app-sqm`, cake qdisc), then repeat the
loaded-latency test. Expect latency under load < 50 ms.

Change 3 — schedule the NAS backup at night or cap its upload rate.

## Cisco IOS equivalent of the same checks

```text
show interfaces GigabitEthernet0/1 | include errors|drops|duplex
show ip route 0.0.0.0
ping 1.1.1.1 repeat 100
traceroute 1.1.1.1
show ip dns view
show policy-map interface GigabitEthernet0/1        ! QoS drops
```

## Report to the user

```markdown
Penyebab utama:
1. DNS router memakai server ISP yang lambat/gagal → sudah diganti ke 1.1.1.1/8.8.8.8 (website langsung kebuka).
2. Backup NAS tiap sore memenuhi upload → latensi naik 30×. Sudah dipasang SQM; backup dipindah ke jam 01.00.
3. Sinyal Wi-Fi kamar lemah (−74 dBm) → saran: access point/mesh di lorong.
4. Ada packet loss 6% mulai dari jaringan ISP → lampirkan hasil mtr ini saat lapor ke ISP.
Rollback tiap perubahan tercatat di catatan perubahan.
```
