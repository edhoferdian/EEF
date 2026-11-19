# Code Recipes — measure, grade, cut, verify

Starting code for the method in `distillation.md` and `application.md`.
Python 3.11+, `ffmpeg` on PATH. Check current library APIs before relying
on them (PySceneDetect and OpenCV change signatures between majors).

```bash
pip install opencv-python numpy scenedetect
```

## 1. Shot boundaries and cadence (PySceneDetect)

```python
from scenedetect import detect, ContentDetector

def shot_lengths(path: str, threshold: float = 27.0) -> list[float]:
    scenes = detect(path, ContentDetector(threshold=threshold))
    return [(end - start).get_seconds() for start, end in scenes]

lengths = shot_lengths("reference.mp4")
median = sorted(lengths)[len(lengths) // 2]
print(f"{len(lengths)} shots, median {median:.2f}s, min {min(lengths):.2f}s, max {max(lengths):.2f}s")
```

Report the median and spread, not the mean — one long establishing shot
skews the mean.

## 2. Sample frames and measure colour in Lab

```python
import cv2, numpy as np

def sample_frames(path: str, every_s: float = 1.0) -> list[np.ndarray]:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step, frames, i = int(fps * every_s), [], 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % step == 0:
            frames.append(frame)
        i += 1
    cap.release()
    return frames

def lab_stats(frames: list[np.ndarray], mask: np.ndarray | None = None) -> dict:
    """Median and MAD per Lab channel — robust to outlier frames."""
    labs = [cv2.cvtColor(f, cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32) for f in frames]
    px = np.concatenate(labs)
    if mask is not None:
        px = px[np.tile(mask.reshape(-1), len(frames))]
    med = np.median(px, axis=0)
    mad = np.median(np.abs(px - med), axis=0)
    return {"L": (med[0], mad[0]), "a": (med[1], mad[1]), "b": (med[2], mad[2])}

ref = lab_stats(sample_frames("reference.mp4"))
src = lab_stats(sample_frames("my_footage.mp4"))
```

Zone statistics (shadows / mids / highlights) — split by L:

```python
def zone_chroma(frames, edges=(0, 85, 170, 256)):
    px = np.concatenate([cv2.cvtColor(f, cv2.COLOR_BGR2LAB).reshape(-1, 3) for f in frames]).astype(np.float32)
    out = {}
    for name, lo, hi in zip(("shadows", "mids", "highlights"), edges[:-1], edges[1:]):
        z = px[(px[:, 0] >= lo) & (px[:, 0] < hi)]
        out[name] = (float(np.median(z[:, 1])), float(np.median(z[:, 2]))) if len(z) else None
    return out
```

Mask out interface elements (subtitles, logos, UI) before measuring, as
`distillation.md` requires — a white caption bar distorts the highlights.

## 3. Bake a 3D LUT (.cube) from the measured transfer

A simple, explainable transfer: match per-channel median and spread in Lab.
Bake it into a 33³ LUT so any NLE or ffmpeg can apply it.

```python
def transfer(lab: np.ndarray, src: dict, ref: dict, strength: float = 1.0) -> np.ndarray:
    out = lab.copy()
    for i, ch in enumerate("Lab"):
        s_med, s_mad = src[ch]; r_med, r_mad = ref[ch]
        scale = (r_mad / s_mad) if s_mad > 1e-3 else 1.0
        mapped = (lab[..., i] - s_med) * scale + r_med
        out[..., i] = lab[..., i] + strength * (mapped - lab[..., i])
    return np.clip(out, 0, 255)

def write_cube(path: str, src: dict, ref: dict, size: int = 33, strength: float = 0.8):
    grid = np.linspace(0, 1, size, dtype=np.float32)
    # .cube order: red varies fastest, then green, then blue
    b, g, r = np.meshgrid(grid, grid, grid, indexing="ij")
    rgb = np.stack([r, g, b], axis=-1).reshape(-1, 1, 3)
    bgr8 = (rgb[..., ::-1] * 255).astype(np.uint8)
    lab = cv2.cvtColor(bgr8, cv2.COLOR_BGR2LAB).astype(np.float32)
    graded = cv2.cvtColor(transfer(lab, src, ref, strength).astype(np.uint8), cv2.COLOR_LAB2BGR)
    out_rgb = graded[..., ::-1].reshape(-1, 3) / 255.0
    with open(path, "w") as f:
        f.write(f'TITLE "matched"\nLUT_3D_SIZE {size}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        for r_, g_, b_ in out_rgb:
            f.write(f"{r_:.6f} {g_:.6f} {b_:.6f}\n")

write_cube("matched.cube", src, ref)
```

Keep `strength` below 1 at first; full transfer often over-saturates skin.
Never bake clipping into the LUT — check the extremes of the grid.

## 4. Apply the LUT and cut (ffmpeg)

```bash
# Grade
ffmpeg -i my_footage.mp4 -vf "lut3d=matched.cube" -c:v libx264 -crf 18 -preset slow -c:a copy graded.mp4

# Cut a shot from 12.4 s, 2.1 s long (re-encode for frame accuracy)
ffmpeg -ss 12.4 -i graded.mp4 -t 2.1 -c:v libx264 -crf 18 -an shot_03.mp4

# Concatenate shots in order
printf "file 'shot_01.mp4'\nfile 'shot_02.mp4'\nfile 'shot_03.mp4'\n" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c copy assembled.mp4

# Overlay a plate (PNG with alpha) at a fixed position for 3 s
ffmpeg -i assembled.mp4 -i plate.png -filter_complex "[0][1]overlay=x=64:y=H-h-96:enable='between(t,1,4)'" -c:a copy out.mp4

# Vertical 1080x1920 crop for Reels/TikTok, centre-weighted
ffmpeg -i out.mp4 -vf "crop=ih*9/16:ih,scale=1080:1920" -c:a copy vertical.mp4
```

## 5. Verify numerically

```python
def delta_report(ref: dict, got: dict) -> str:
    rows = []
    for ch in "Lab":
        rows.append(f"{ch}: median Δ {got[ch][0] - ref[ch][0]:+.1f}, spread Δ {got[ch][1] - ref[ch][1]:+.1f}")
    return "\n".join(rows)

print(delta_report(ref, lab_stats(sample_frames("graded.mp4"))))
```

Set a tolerance before grading (e.g. median Δ within ±3 on L, ±2 on a/b)
and report pass/fail per channel, plus the cut rhythm comparison:

```python
mine = shot_lengths("assembled.mp4")
print(f"median shot: reference {median:.2f}s vs mine {sorted(mine)[len(mine)//2]:.2f}s")
```

## 6. Hand off to an NLE

- Deliver the `.cube`, the graded proxy, and an EDL/FCPXML/OTIO timeline of
  the cuts so the editor can refine.
- OpenTimelineIO can write a timeline from your cut list:

```python
import opentimelineio as otio
tl = otio.schema.Timeline(name="assembled")
track = otio.schema.Track(); tl.tracks.append(track)
for path, start, dur in cuts:   # (file, seconds, seconds)
    rate = 30
    clip = otio.schema.Clip(name=path,
        media_reference=otio.schema.ExternalReference(target_url=path),
        source_range=otio.opentime.TimeRange(otio.opentime.RationalTime(start * rate, rate), otio.opentime.RationalTime(dur * rate, rate)))
    track.append(clip)
otio.adapters.write_to_file(tl, "assembled.otio")
```
