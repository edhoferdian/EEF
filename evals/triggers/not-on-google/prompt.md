---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
tags: [id, coverage]
---

Toko online kami sudah 3 bulan live, tapi di Google cuma halaman depan yang muncul — halaman produknya gak ada satu pun. Ini yang aku tahu:

robots.txt:

```
User-agent: *
Disallow: /cart
Disallow: /*?sort=
Sitemap: https://staging.tokokopisenja.id/sitemap.xml
```

`<head>` halaman produk /produk/kopi-gayo-250g (semua halaman produk mirip):

```html
<title>Toko Kopi Senja</title>
<meta name="description" content="Toko Kopi Senja">
<link rel="canonical" href="https://tokokopisenja.id/">
```

Daftar produk di halaman kategori:

```html
<div class="card" onclick="location.href='/produk/kopi-toraja-250g'">Kopi Toraja 250g</div>
<div class="card" onclick="location.href='/produk/kopi-gayo-250g'">Kopi Gayo 250g</div>
```
