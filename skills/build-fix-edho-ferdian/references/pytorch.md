# PyTorch — training/inference runtime diagnostic lens

Adapted from ECC `pytorch-patterns`, fetched 2026-09-07.

Scope: PyTorch training or inference code that fails to run — tensor shape
mismatches, device-placement (CPU/GPU) errors, CUDA out-of-memory, AMP/
mixed-precision failures, and `DataLoader` worker crashes. You fix the
runtime error only — you do not redesign the model architecture, change the
training algorithm, or touch ML-content correctness (feature leakage, split
strategy, promotion gates). This is narrower than the review-side gap:
`code-review-edho-ferdian/references/mle-lens.md` already covers the review
side of ML code (data leakage, lifecycle, ML-01..06) and explicitly hands
off exactly this runtime-mechanics gap to this skill in its own "Handoffs"
section — if the code runs fine but is wrong or wasteful, that's a review
task, not a build-fix task.

## Diagnostic commands

Run these in order to localize the error before touching anything:

```bash
# Confirm the environment actually has what the code expects
python -c "import torch; print(torch.__version__)"
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.device_count())"
nvidia-smi                                    # GPU present, driver/CUDA version, current memory usage

# Reproduce with full traceback, unedited
python train.py 2>&1 | tail -n 60

# Isolate a shape/device error to one forward pass
python -c "
import torch
from model import MyModel
m = MyModel()
x = torch.randn(1, *expected_input_shape)
print(m(x).shape)
"

# CUDA OOM: check what's actually resident before assuming batch size is the cause
python -c "import torch; print(torch.cuda.memory_summary())"

# DataLoader worker crashes: reproduce single-process first to get a real traceback
# (multiprocessing swallows/mangles worker tracebacks)
python -c "
from dataset import MyDataset
from torch.utils.data import DataLoader
dl = DataLoader(MyDataset(...), batch_size=4, num_workers=0)
next(iter(dl))
"
```

## Resolution workflow

```
1. Reproduce the error           -> capture the FULL traceback, unedited
                                     (for DataLoader worker crashes, rerun with
                                     num_workers=0 first — the real traceback is
                                     otherwise hidden behind a generic worker-death
                                     message)
2. Identify the error family     -> use the tables below
3. Read the affected file        -> understand tensor flow / device flow before editing
4. Apply the minimal fix         -> only what the error demands
5. Re-run the isolated repro     -> confirm the specific error is gone
6. Run the full training/eval step -> confirm nothing else broke
```

## Tensor shape mismatches

| Error | Cause | Fix |
|---|---|---|
| `RuntimeError: shape '[a, b]' is invalid for input of size N` | A `.view()`/`.reshape()` target doesn't match the actual number of elements — usually an upstream conv/pool output size was assumed, not computed | Compute the flatten dimension from the actual tensor (`x.view(x.size(0), -1)`) instead of a hardcoded literal, or print `x.shape` right before the failing call to get the real size |
| `RuntimeError: mat1 and mat2 shapes cannot be multiplied (AxB and CxD)` | A `Linear` layer's `in_features` doesn't match the flattened input size, or a matmul has mismatched inner dimensions | Fix the `Linear(in_features=..., ...)` declaration to match the real flattened size, or transpose one operand if the multiplication order is wrong |
| `RuntimeError: The size of tensor a (X) must match the size of tensor b (Y) at non-singleton dimension N` | Element-wise op (add, mul, loss) between two tensors that don't broadcast — usually a batch-size or channel mismatch between prediction and target | Print both tensors' `.shape` immediately before the op; confirm the target/label tensor has the shape the loss function actually expects (e.g. `CrossEntropyLoss` wants class indices, not one-hot, unless using a different loss) |
| `IndexError: index X is out of bounds for dimension N with size Y` | Indexing/slicing assumes a dimension size that isn't actually there (e.g. assuming a channel dim that was already squeezed) | Print `.shape` at the indexing site; add an explicit `assert` documenting the expected shape at that point going forward |

```bash
# Fastest way to localize which layer breaks the shape chain
python -c "
import torch
from model import MyModel
m = MyModel()
x = torch.randn(1, *expected_input_shape)
for name, layer in m.named_children():
    x = layer(x)
    print(name, tuple(x.shape))
"
```

## Device-placement errors

| Error | Cause | Fix |
|---|---|---|
| `RuntimeError: Expected all tensors to be on the same device, but found at least two devices` | Model on GPU but an input/target/hidden-state tensor still on CPU (or vice versa) — commonly a tensor created mid-forward-pass (`torch.zeros(...)`, a mask, a positional-encoding buffer) that wasn't moved | Create the tensor directly on the right device (`torch.zeros(..., device=x.device)`) rather than moving it after the fact — this also survives multi-GPU setups where "the right device" isn't a fixed constant |
| `AssertionError: Torch not compiled with CUDA enabled` / `.cuda()` on a CPU-only install | Code hardcodes `.cuda()` instead of resolving a device once (`torch.device("cuda" if torch.cuda.is_available() else "cpu")`) | Replace every hardcoded `.cuda()`/`.to("cuda")` with `.to(device)` using a single resolved `device` variable; see `references/pytorch.md` in `language-code-review-edho-ferdian` for the review-side version of this same finding |
| `RuntimeError: CUDA error: device-side assert triggered` | Usually an out-of-range index feeding an embedding/index op (label value >= num_classes, or an index tensor with a bad value) — the real cause is often several lines upstream of where CUDA reports it | Re-run with `CUDA_LAUNCH_BLOCKING=1 python train.py` to get an accurate line number instead of a delayed/misattributed one |
| Silent wrong results, no error, when mixing CPU and GPU tensors in a comparison/mask | Some ops implicitly move or fail to broadcast across devices without raising | Never assume "it ran without error" proves device correctness for boolean/mask ops — check `.device` on both operands explicitly when debugging |

```bash
# Force synchronous CUDA errors with accurate line numbers
CUDA_LAUNCH_BLOCKING=1 python train.py
```

## CUDA out-of-memory (OOM)

| Symptom | Cause | Fix |
|---|---|---|
| `torch.cuda.OutOfMemoryError: CUDA out of memory. Tried to allocate X GiB` | Batch size, model size, or activation memory exceeds available GPU memory — check `torch.cuda.memory_summary()` before assuming batch size alone is the fix | Reduce batch size first (cheapest, verify it actually fixes it before further changes); if batch size is already minimal, enable AMP (`torch.amp.autocast` + `GradScaler`) and/or gradient checkpointing (`torch.utils.checkpoint`) to trade compute for memory |
| OOM only after several epochs, not immediately | A memory leak — most often gradients or activations retained because `.item()`/`.detach()` wasn't called before accumulating a running loss/metric across the whole training run | Accumulate scalar metrics with `.item()` (converts to a Python float, detaches from the graph) rather than keeping the tensor itself in a running list |
| OOM during validation, not training | `model.eval()` set but `torch.no_grad()` (or `@torch.no_grad()`) missing — gradients still being tracked and stored during the eval forward pass | Wrap the eval loop in `torch.no_grad()`; this is also a correctness issue independent of OOM (see the review-side finding for missing `eval()`/`no_grad()` pairing) |
| OOM immediately at model construction, before any training data | Model itself too large for the GPU, or an accidental duplicate model instantiation (e.g. both CPU and GPU copies alive at once) | Confirm only one live copy of the model exists; consider a smaller model, mixed precision, or model/tensor parallelism if the model genuinely doesn't fit |

```bash
# Inspect current allocator state — tells you what's actually resident, not just "OOM"
python -c "import torch; print(torch.cuda.memory_summary())"

# Reduce fragmentation-related OOM (PyTorch 2.x allocator tuning)
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True python train.py
```

## AMP / mixed-precision failures

| Error / symptom | Cause | Fix |
|---|---|---|
| `RuntimeError: Attempting to unscale FP16 gradients` | `scaler.unscale_(optimizer)` (or `scaler.step`) called more than once per iteration, or called on an optimizer whose gradients were never scaled in the first place | Ensure exactly one `scaler.scale(loss).backward()` → `scaler.unscale_(optimizer)` (only if doing manual grad clipping) → `scaler.step(optimizer)` → `scaler.update()` sequence per iteration, with no duplicate calls |
| Loss becomes `NaN`/`inf` only when AMP is enabled | FP16 underflow/overflow in a numerically sensitive op (log, exp, softmax on extreme values) not excluded from autocast, or the scaler's initial scale factor is poorly suited to the loss magnitude | Wrap only the forward pass in `autocast`, keep the loss computation for numerically sensitive ops in FP32 where the framework doesn't already special-case them; let `GradScaler` auto-adjust (it does by default) rather than hand-tuning `init_scale` first |
| Gradient clipping has no effect (or clips far too aggressively) under AMP | `torch.nn.utils.clip_grad_norm_` called on still-scaled gradients — clipping is measuring the wrong magnitude | Always `scaler.unscale_(optimizer)` before any manual gradient-clipping call under AMP |
| `autocast` has no measurable speed effect | GPU doesn't support the relevant reduced-precision path (older architecture), or the bottleneck is actually the DataLoader / CPU-bound preprocessing, not compute | Confirm with `torch.profiler` where time is actually spent before assuming AMP configuration is the problem |

```bash
# Confirm whether autocast is actually being entered (quick sanity check)
python -c "
import torch
with torch.amp.autocast('cuda'):
    print(torch.get_autocast_gpu_dtype())
"
```

## DataLoader worker crashes

| Error | Cause | Fix |
|---|---|---|
| Worker process dies with a generic `RuntimeError: DataLoader worker (pid X) is killed by signal` (no useful traceback) | The real exception happened inside a worker process and multiprocessing mangled/hid it — or the worker ran out of memory (each worker holds its own copy of anything captured in the `Dataset`) | Rerun with `num_workers=0` first to get the actual traceback in the main process; if it only fails with workers > 0, suspect per-worker memory (large in-memory cache in `__init__`) rather than logic |
| `RuntimeError: unable to open shared memory object` or similar under Docker | The container's `/dev/shm` is too small for the configured number of workers/batch size | Increase `--shm-size` on the container, or reduce `num_workers`/`pin_memory` load as a workaround |
| Hangs indefinitely on the first batch with `num_workers > 0` | A `Dataset` or `collate_fn` holds a non-picklable object as an instance attribute (an open file handle, a CUDA tensor, a lambda, a live network connection) — workers are separate processes and everything the `Dataset` references must pickle across the fork/spawn boundary | Open file handles / DB connections lazily inside `__getitem__` (or via a per-worker `worker_init_fn`), not in `__init__`; never store a CUDA tensor on the `Dataset` itself |
| `RuntimeError: cannot pickle '...' object` at DataLoader startup | Same root cause as above, surfaced explicitly at construction time (Windows more often shows this than Linux, since Windows always uses `spawn`, not `fork`) | Move the unpicklable object's creation into `worker_init_fn` or lazy-init it on first access inside `__getitem__` |
| Silent data corruption / same batch repeated across workers | Missing or improperly seeded per-worker random state (each worker inherits the parent's RNG state after fork, causing identical augmentation across workers) | Set a per-worker seed in `worker_init_fn` using `torch.utils.data.get_worker_info().id` combined with a base seed |

```bash
# Reproduce single-process to get a real traceback before touching worker config
python -c "
from dataset import MyDataset
ds = MyDataset(...)
print(ds[0])
"

# Confirm shared memory size inside a container
df -h /dev/shm
```

## Anti-suppression reminders

- Do not "fix" a CUDA OOM by silently wrapping the training step in a
  try/except that skips the batch — this hides a capacity problem and
  corrupts the effective batch composition seen by the model.
- Do not "fix" a shape mismatch by inserting an unexplained `.squeeze()`/
  `.unsqueeze()`/`.view(-1)` that happens to make the numbers line up
  without understanding *why* the shapes diverged — that's the review-side
  finding (undocumented shape assumption) reappearing as a build-fix patch;
  confirm the intended shape at each step before changing it.
- Do not disable AMP entirely as the fix for a scaler-related crash unless
  mixed precision is genuinely not needed for this workload — fix the
  scale/unscale sequencing first.

## Handoffs

- The code runs but is wrong, wasteful, or fragile (documented-but-unverified
  shapes, repeated device transfers inside a loop, missing `eval()`/
  `no_grad()`, in-place ops that don't yet crash) →
  `language-code-review-edho-ferdian/references/pytorch.md`, a review-side
  concern, not a build-fix one.
- ML content — feature leakage, split integrity, promotion gates, model
  versioning, rollback design → `code-review-edho-ferdian/references/
  mle-lens.md`, out of scope here entirely.
- Generic Python environment/dependency errors not specific to PyTorch
  (missing package, venv not active, `pip` conflicts) →
  `references/django-python.md`'s dependency-resolution table covers the
  same `pip`/`ImportError` failure modes and applies here unchanged.

## Provenance

Adapted from ECC `pytorch-patterns`, fetched 2026-09-07.
