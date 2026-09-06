# Language Lens — PyTorch (framework mechanics only)

Adapted from ECC `pytorch-patterns`, fetched 2026-09-07.

**Detect.** A real PyTorch training/inference script or module in review
scope — `import torch`, an `nn.Module` subclass, a training loop calling
`.backward()`/`optimizer.step()`, or a `DataLoader` construction.

**Boundary — read before flagging anything.** This lens is deliberately
narrow. `code-review-edho-ferdian/references/mle-lens.md` already owns
**everything** about the ML content of the code: point-in-time feature
leakage (ML-01), random splits on time/entity-dependent data (ML-02),
train/serve transformation skew (ML-03), promotion-gate discipline (ML-04),
model versioning in prediction logs (ML-05), rollback design (ML-06), and
the entire operational-lifecycle checklist (data contract, reproducible
training, quality gates, deployment versioning, monitoring). `mle-lens.md`'s
own "Handoffs" section explicitly excludes framework mechanics from its
scope and hands them to this file instead:

> Tensor shape, device, gradient, CUDA, DataLoader, or AMP failures blocking
> training/inference → out of scope for this lens; note the gap rather than
> guessing at a fix.

So: if the finding is about *what the model does* (leakage, splits, gates,
lifecycle) → `mle-lens.md`, not here. If the finding is about *whether the
PyTorch code runs correctly and efficiently as PyTorch code* (shapes,
devices, AMP, DataLoader) → here. When both lenses are active on the same
diff, don't double-report a finding under both — file it under whichever
lens owns the failure mode above, and cross-reference the other.

**Code placement.** Findings land as **CQ-10 (framework/idiom
anti-patterns)** in the general report, the same code the other
language lenses (`python.md`, `react.md`, etc.) use for their own
idiom-specific findings — this file does not introduce a new code family.
Runtime crashes that block execution entirely (the code doesn't compile/run
at all) are out of scope for review and belong to
`build-fix-edho-ferdian/references/pytorch.md` instead — this lens is for
code that runs but is wrong, wasteful, or fragile.

---

## Ground-truth commands

```bash
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
mypy .                               # type-hint discipline on tensors/modules
ruff check .                         # general idiom lint
pytest -k "model or forward or shape"  # if shape-assertion tests exist, run them
```

A shape or device claim you can't confirm by reading the surrounding
`.view`/`.reshape`/`.to(device)` calls stays at [Medium confidence] — note
what would confirm it (e.g. "would need a sample forward pass to confirm
the flattened dimension").

---

## Lens criteria

### HIGH

- **Tensor shape assumed, not verified or documented** — a `.view()`/
  `.reshape()`/`.flatten()` call whose target shape depends on an upstream
  layer's output size with no comment, assertion, or shape annotation
  showing the expected shape at each step. Silent shape mismatches either
  crash with an opaque `RuntimeError: shape '[...]' is invalid` or, worse,
  broadcast incorrectly and train on garbage without erroring at all. Fix:
  annotate the expected shape at each transformation (`# (batch, C, H, W)
  -> (batch, C*H*W)`), or assert it explicitly (`assert x.shape[1:] ==
  expected_shape`).
- **Hardcoded device instead of device-agnostic placement** — `.cuda()`
  called directly on a model or tensor instead of `.to(device)` with a
  `device = torch.device("cuda" if torch.cuda.is_available() else "cpu")`
  resolved once at startup. Hardcoding `.cuda()` crashes outright on any
  CPU-only environment (dev laptop, CI runner, CPU-only inference host).
- **Model or tensor moved to device repeatedly inside the training/inference
  loop** — `model.to(device)` (or `.cuda()`) called on every iteration
  instead of once before the loop starts. Wastes a device transfer per step
  and is a signal the device-placement code was copy-pasted without
  understanding scope; look for the same mistake on `data`/`target` (those
  *should* move every iteration, since the batch changes — don't flag that
  as the same issue).
- **AMP `autocast` and `GradScaler` used inconsistently** — `autocast()`
  wraps the forward pass but the backward/step path doesn't use the
  matching `scaler.scale(loss).backward()` / `scaler.step(optimizer)` /
  `scaler.update()` sequence (or vice versa: a `GradScaler` instantiated but
  never actually used because the forward pass isn't inside `autocast`).
  Partial AMP adoption silently trains at full precision (no speedup, no
  bug) or produces NaN losses (scaler present but gradients never
  unscaled before a clipping step). Also flag `scaler.unscale_(optimizer)`
  missing before `torch.nn.utils.clip_grad_norm_` when AMP is in use —
  clipping unscaled gradients under a scale factor clips the wrong
  magnitude entirely.
- **`DataLoader` worker configuration mismatched to the workload** —
  `num_workers=0` (the default) left in place for a real training run,
  or `num_workers > 0` combined with a `Dataset`/`collate_fn` that isn't
  fork/spawn-safe (e.g. holds an open file handle, a CUDA tensor, or a
  non-picklable object as an instance attribute) — both silently working
  fine in a demo notebook but stalling or crashing under real load. Also
  flag `persistent_workers=True` combined with `num_workers=0` (invalid
  combination, either ignored or an explicit error depending on version).

### MEDIUM

- **Missing `model.train()` / `model.eval()` mode switch** — a validation
  or inference pass that never calls `model.eval()` before running,
  leaving `Dropout` active and `BatchNorm` using batch statistics instead
  of running statistics. Produces inconsistent, non-reproducible eval
  metrics without ever raising an error — the classic silent-and-wrong
  failure mode for this framework. Pair with `torch.no_grad()` (or
  `@torch.no_grad()`) for the same eval path if gradients aren't needed.
- **In-place tensor op on a value still needed by autograd** — `x =
  F.relu(x, inplace=True)` or `x += residual` on a tensor that autograd
  still needs in its original form for the backward pass. Sometimes raises
  `RuntimeError: one of the variables needed for gradient computation has
  been modified by an inplace operation`, sometimes silently computes the
  wrong gradient depending on graph structure — don't assume "it didn't
  error" means it's correct.
- **`.item()` (or `.cpu().numpy()`) called before `.backward()`** on a loss
  tensor that's still needed for backprop — detaches from the autograd
  graph. Correct order: call `.backward()` (or otherwise finish using the
  tensor in the graph) first, then `.item()` only for logging afterward.
- **`DataLoader` missing `pin_memory=True` when training on GPU** — slower
  host-to-device transfer than necessary; low severity on its own but worth
  flagging alongside other DataLoader findings in the same diff.

### LOW

- **`torch.save(model, path)` instead of `torch.save(model.state_dict(),
  path)`** — pickles the entire module graph (fragile across code changes,
  not portable across environments) instead of just the learned weights.
- **Missing `weights_only=True` on `torch.load`** for a checkpoint loaded
  from anything other than a fully trusted, self-produced file — loading
  arbitrary pickled objects is a deserialization risk. If the checkpoint
  source is external or shared, escalate this to Domain 2 (SEC) instead of
  filing it here — this file only owns the mechanical fix.

---

## Handoffs

- ML content — leakage, split integrity, promotion gates, rollback design,
  the operational lifecycle checklist → `references/mle-lens.md`, not this
  file.
- The code doesn't run at all (an actual `RuntimeError`, CUDA OOM, or
  crash reproducing right now) → this is a build-fix task, not a review
  task: `build-fix-edho-ferdian/references/pytorch.md`.
- Generic Python idioms (mutable defaults, bare `except`, missing type
  hints) not specific to PyTorch → `references/python.md`.
- Secrets/PII in checkpoints, datasets, or logs; unsafe deserialization of
  an untrusted checkpoint → Domain 2 (SEC) / `mle-lens.md`'s own
  cross-reference to Domain 2, not this file.

## Provenance

Adapted from ECC `pytorch-patterns`, fetched 2026-09-07.
