# Post-deploy watch

Adapted from ECC `canary-watch`, fetched 2026-09-04.

**Different activity from `e2e-testing-edho-ferdian/references/qa-sweep.md`.**
A QA sweep is one broad pass ending in a ship/no-ship verdict. This is a
narrow, repeated, unattended watch across a release window, judged against a
*baseline delta* rather than an absolute pass/fail. Run the sweep before you
ship; run this after.

Do not restate here: the sweep's smoke checklist, its blast-radius rules, or
Core Web Vitals budgets (`performance-audit-edho-ferdian` owns those). This
file only adds what repetition and baselines make possible.

## Modes

| Mode | Shape | Use |
|---|---|---|
| Single pass | One check, report | Confirming a fix landed |
| Sustained | Every N minutes for M hours | Launch window, risky merge |
| Diff | Staging vs production, same checks | Isolating "is it the release or the environment?" |

## What a watch adds over a sweep

1. **Static-asset integrity** — every JS, CSS, font, and image request returns
   2xx/3xx with the expected content type. A CDN or build-hash mismatch shows
   up here and nowhere else.
2. **Stream health** — for SSE / event-stream endpoints: does it connect, and
   does the first event or heartbeat arrive? Measure heartbeat latency, not
   just connection success.
3. **Baseline deltas** — a page at LCP 2.3s passes every absolute budget and
   is still a regression if yesterday it was 1.4s. Store the baseline; compare
   against it.

## Alert tiers

| Tier | Examples | Action |
|---|---|---|
| Critical | non-200, new console errors > 5, API 5xx, static asset 4xx/5xx, SSE will not connect | Stop the rollout; execute the rollback from `release-strategies.md` |
| Warning | LCP +500ms vs baseline, CLS > 0.1, response time > 2x baseline, asset content-type changed | Record and investigate; do not auto-rollback |
| Info | minor variance, new third-party requests appearing | Log only — but a *new third-party script* is a security question, hand it to `security-review-edho-ferdian` |

## Verifikasi ≠ validasi

*(adapted from ECC `quality-nonconformance`, fetched 2026-09-06)*

Dua pertanyaan berbeda yang sering diruntuhkan jadi satu, dan meruntuhkannya
adalah cara paling umum sebuah insiden dinyatakan tertutup padahal belum:

- **Verifikasi** — apakah perbaikannya benar-benar ter-deploy seperti yang
  direncanakan? (commit ada di rilis; flag menyala di env yang benar; migrasi
  benar-benar jalan). Ini fakta biner, dan biasanya inilah satu-satunya yang
  dicek sebelum sebuah isu ditutup.
- **Validasi** — apakah perbaikannya benar-benar menghentikan hal yang mau
  dihentikan? Ini butuh **data setelah deploy sepanjang jendela yang cukup
  panjang untuk membedakan "sudah berhenti" dari "kebetulan belum kambuh"**.
  Panjangnya tidak boleh ditebak: ambil dari periodisitas gejalanya sendiri.
  Bug yang muncul saat lonjakan mingguan butuh minimal beberapa siklus
  mingguan; kegagalan job nightly butuh beberapa malam; bug yang terpicu
  rilis butuh beberapa rilis.

Aturan penutupan: **kalau gejalanya kambuh di dalam jendela validasi, isunya
dibuka lagi — jangan dibuat isu baru untuk kegagalan yang sama.** Isu baru
mereset jam dan menyembunyikan fakta terpenting yang kamu punya, yaitu bahwa
fix pertama tidak efektif. Selain gejala spesifiknya, cek juga apakah metrik
tetangganya ikut membaik (error rate endpoint tersebut, bukan hanya stack
trace persisnya) — perbaikan yang menyembuhkan tepat satu tanda tangan error
sambil membiarkan tetangganya datar biasanya menekan gejala, bukan sebab.

## Report shape

Report deltas, not absolutes, and always name the baseline's date. A watch
report without a baseline reference is an unlabelled snapshot.

Every finding that turns out to be a repeatable user-flow defect must become a
mapped journey and a committed test in `e2e-testing-edho-ferdian` — a watch
that only ever produces reports will re-find the same defect next release.
