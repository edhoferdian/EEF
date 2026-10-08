# notify

Send build notifications to a chat webhook.

```python
from notify import Client

client = Client(webhook_url="https://chat.example.com/hooks/T0123")
client.send("Build finished", retries=5)
```

`send` retries on HTTP 5xx with exponential backoff and raises
`notify.DeliveryError` when it gives up.
