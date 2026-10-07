---
max_turns: 6
timeout_seconds: 240
allowed_tools: [Read, Glob, Grep, Skill]
tags: [id]
---

Cek keamanan kode ini dong, takut ada celah:

```python
@app.get('/user')
def user():
    q = f"SELECT * FROM users WHERE id = {request.args['id']}"
    return db.execute(q).fetchall()
```
