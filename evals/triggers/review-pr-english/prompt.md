---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
tags: [en]
---

Can you review this change before I open the PR? Looking for bugs mostly.

```python
def average(xs):
    return sum(xs) / len(xs)
```
