---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
tags: [id]
---

Sederhanakan fungsi ini dong, nesting-nya kebanyakan:

```js
function label(u) {
  if (u) {
    if (u.active) {
      if (u.admin) { return 'admin'; } else { return 'user'; }
    } else { return 'inactive'; }
  } else { return 'guest'; }
}
```
