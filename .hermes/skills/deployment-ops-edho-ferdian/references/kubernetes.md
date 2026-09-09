# Kubernetes workload patterns

## Probes — the trio, in the right roles

Use `startupProbe` for slow boots, then let liveness and readiness take over.
Inflating `initialDelaySeconds` on liveness instead is the single most common
manifest error: it either restarts a healthy-but-slow pod, or blinds you for
the delay window.

## Requests and limits

- **No requests and no limits** → unpredictable scheduling and OOM eviction.
- **Limits without requests** → requests silently default to limits and you
  over-reserve the cluster.
- Set requests from observed p50 usage, limits from observed p99 plus headroom.

## Secrets

Kubernetes `Secret` values are base64-**encoded**, not encrypted. Anyone with
namespace read access reads them in plaintext. Real encryption needs Sealed
Secrets, External Secrets Operator, or a vault.
→ Full secret-handling rules: `security-review-edho-ferdian`.

## RBAC

Default to a ServiceAccount with `automountServiceAccountToken: false`. Only
grant API access when the workload genuinely calls the API server, and then
namespace-scoped `Role` over `ClusterRole` every time.

## Availability

`PodDisruptionBudget` is what makes a node drain safe; without one, a cluster
upgrade can take every replica down at once. `HorizontalPodAutoscaler` without
resource *requests* cannot compute utilisation and will not scale.

## kubectl triage order

```bash
kubectl get events --sort-by=.lastTimestamp   # cluster-level cause first
kubectl describe pod <pod>                    # then scheduling / probe detail
kubectl logs <pod> --previous                 # then the crashed container
```
