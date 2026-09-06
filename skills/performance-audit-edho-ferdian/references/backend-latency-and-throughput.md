# Backend latency and throughput

Adapted from ECC `latency-critical-systems` and `data-throughput-accelerator`,
fetched 2026-09-04. Companion to `web-frontend.md` and `react-nextjs.md`:
same measure-then-fix workflow, server-side surface.

## Split the metric before optimising

"Slow" is never one number. Track separately: p50 / p95 / p99 latency,
throughput, **freshness age**, queue depth, cache hit rate, upstream API
response time, and correctness under load. A system can improve p50 while p99
and freshness both degrade — reporting only the mean hides exactly the
regression users feel.

## Map the hot path, then measure each segment

```
source event → provider API → ingest worker → queue → cache → edge route
→ client stream → browser render → user-visible state
```

Measure per segment. Optimising a segment you have not isolated is guessing.

## Optimisation order

1. Remove round trips.
2. Cache stable reads **with freshness metadata** attached.
3. Batch small calls and writes.
4. Move compute closer to the data or the user.
5. Split hot and cold paths.
6. Apply backpressure *before* the queue grows unbounded.
7. Use streaming only when it improves freshness or perceived responsiveness.
8. Add canaries for stale data, degraded providers, and bad cache state.

## Verifikasi constraint — antrean bukan bukti constraint

*(adapted from ECC `production-scheduling`, fetched 2026-09-06)*

Mengukur sudah memisahkanmu dari menebak. Ia belum memisahkanmu dari
mengoptimalkan hal yang salah. Tempat penumpukan bukan otomatis tempat
constraint berada, dan tiga kesalahan berikut terlihat identik di profiler.

**1. Antrean di depan sebuah tahap bisa berarti tahap SEBELUMNYA yang
salah.** Request menumpuk di worker pool bisa karena worker memang lambat —
atau karena pemanggil melepas pekerjaan dalam ledakan besar, atau karena
sumber daya bersama (satu pool koneksi, satu lock, satu rate-limited
third-party) menciptakan antrean semu yang tidak ada hubungannya dengan
tahap yang kelihatan penuh. Menambah worker pada korban penjadwalan hulu
menaikkan penggunaan sumber daya tanpa menaikkan throughput sama sekali.

**2. Uji kausal, bukan uji peringkat.** Peringkat "paling banyak makan waktu"
saja tidak cukup. Pertanyaan yang menentukan: **kalau tahap ini diberi satu
satuan kapasitas lagi, apakah throughput ujung-ke-ujung naik?** Kalau
jawabannya tidak — misalnya tahap hilirnya toh selalu kelaparan setiap kali
tahap ini berhenti — maka ia bukan constraint-nya, betapapun besar porsinya
di flame graph. Cara termurah menjawabnya biasanya eksperimen kecil (naikkan
concurrency/pool/replica satu langkah, ukur ulang throughput agregat, bukan
latensi tahap itu), bukan analisis lebih dalam.

**3. Mengoptimalkan non-constraint menghasilkan nol.** Membuat tahap
non-constraint 2x lebih cepat hanya membuatnya menunggu 2x lebih lama, atau
menumpuk pekerjaan setengah jadi lebih cepat di depan constraint yang sama.
Ini kelas "peningkatan" yang paling menipu karena benchmark lokalnya benar-
benar membaik — angka komponennya jujur, kesimpulannya yang salah. Karena
itu **delta yang dilaporkan skill ini harus selalu berupa metrik ujung-ke-
ujung, bukan hanya metrik komponen yang disentuh** (lihat
`audit-output-format.md`).

**4. Constraint berpindah.** Setelah constraint pertama diperbaiki,
constraint berikutnya hampir tidak pernah adalah kandidat nomor dua dari
pengukuran awal — sebab profil beban berubah begitu tahap pertama berhenti
menahan sistem. Constraint juga bisa berbeda per bentuk trafik (jam sibuk vs
job batch malam; permintaan cache-hit vs cache-miss). **Ukur ulang dari nol
setelah setiap fix**, dan curigai profil rata-rata yang mencampur beberapa
rezim trafik menjadi satu angka yang tidak menggambarkan satu pun di
antaranya.

**Gate praktis, sebelum menulis fix apapun di Phase 3:** tulis satu kalimat —
"kalau X diperbaiki, throughput/latensi p95 ujung-ke-ujung akan bergerak dari
A ke sekitar B, karena ___". Kalau kalimat itu tidak bisa diselesaikan dengan
angka baseline yang sudah kamu punya, kamu belum mengidentifikasi constraint;
kamu baru mengidentifikasi sesuatu yang lambat.

## Readback verification (deployed surfaces)

A latency fix is not verified until the deployed surface is read back, not
just the local benchmark: HTTP timing and response headers, provider
freshness timestamp, queue/job state, edge/cache state, a browser check that
the freshness is actually visible to the user, and the logs around retry and
degraded-mode paths. If any of these can't be read, lower the confidence on
the finding — don't round it up to "fixed".

## Measure the backlog before optimising a pipeline

A pipeline's baseline is not one runtime number. Count: external files
discovered, manifest rows, raw rows, derived rows, min/max timestamp per
layer, and the unprocessed count. Without these six numbers the accounting
block at the end of a run has nothing to compare against, and "done" is just
a claim.

## Bulk data movement (ETL, backfill, export, warehouse load)

Separate source-extraction speed, transfer speed, load speed, transform speed,
serving-table freshness, and **live-tail growth while the job runs**. A
pipeline can be genuinely fast and still look behind because new data arrives
faster than the catch-up window closes.

Heuristics: move compute to where the data already is; prefer warehouse-native
scans and appends for large landed files; use manifests or checkpoints so
completed partitions are skipped; make writes idempotent via unique keys or
replaceable staging; keep raw, derived, and serving tables separately
accountable; partition and cluster to match the read+append access pattern
the pipeline actually has; batch small **files**, not just small calls and
writes.

Close every run with a hard accounting block — files discovered, files
processed, rows added per layer, remaining tail at readback, runtime, and an
explicit correctness gate (manifest counts and table max timestamps agree).

## Content-hash caching for expensive file processing

Adapted from ECC `content-hash-cache-pattern`, fetched 2026-09-05. Applies
when the hot path includes repeated file processing (PDF parsing, text
extraction, image analysis) rather than pure network/DB latency.

When the same files get reprocessed across runs, use the **SHA-256 hash of
the file's content** — not its path — as the cache key:

- **Rename/move-proof.** A path-based cache key invalidates on every rename
  or relocation even though nothing about the work changed. A content hash
  doesn't care where the file lives — move it, rename it, cache still hits.
- **Auto-invalidates on real change.** If the bytes change, the hash changes,
  and the cache misses on its own — no separate "is this stale" check, no
  manual bust step to forget.
- **O(1) lookup, no index.** Store each entry as `{hash}.json` in the cache
  directory. Looking up a hash is a direct file-path read — no separate
  index file to keep in sync or that can itself go stale/corrupt.
- Chunk the hash read (e.g. 64KB chunks) for large files instead of loading
  the whole file into memory just to hash it.
- Treat a corrupt or unreadable cache entry as a cache miss, not a crash —
  re-derive and rewrite it.

**Single-responsibility discipline.** Keep the processing function pure —
it should take input and return output with zero awareness that caching
exists. Put the cache check/write in a separate service-layer wrapper that
calls the pure function on a miss:

```python
def extract_with_cache(file_path, *, cache_enabled=True, cache_dir=Path(".cache")):
    if not cache_enabled:
        return extract_text(file_path)          # pure function, no cache knowledge
    file_hash = compute_file_hash(file_path)
    cached = read_cache(cache_dir, file_hash)
    if cached is not None:
        return cached.document
    doc = extract_text(file_path)                # same pure function
    write_cache(cache_dir, CacheEntry(file_hash, str(file_path), doc))
    return doc
```

Mixing the `if cache_enabled:` branch *inside* the processing function is
the anti-pattern here: it gives one function two responsibilities
(transform the input, and manage a cache), makes the function untestable
without a cache directory, and makes it impossible to reuse the pure
transform somewhere caching doesn't belong.

## Guardrails

- Do not buy latency by dropping required validation.
- Do not hide stale data behind a fast cache hit — a fast wrong answer is
  worse than a slow right one.
- Do not delete raw data to make a metric look better, and never skip failed
  files silently.
- Do not claim millisecond behaviour from a client-side label; measure it.
- Never put a secret or a private payload in a log or a benchmark artifact —
  the baseline JSON from `Baselines` above gets committed to the repo, so
  redact before saving, not after.
