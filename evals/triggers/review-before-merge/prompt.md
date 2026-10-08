---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
tags: [id, coverage]
---

Tolong cek kode ini sebelum aku merge ya, ada yang salah gak?

```js
function total(items) {
  let sum = 0;
  for (let i = 0; i <= items.length; i++) sum += items[i].price;
  return sum;
}
```
