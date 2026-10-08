# pinger

Checks a list of URLs every minute and posts failures to a webhook.

## Configuration

Configuration is read from `config/settings.yaml`. Each target has a `url`
and an optional `expect_status` (default 200).

```yaml
webhook: https://hooks.example.com/abc
targets:
  - url: https://example.com/health
  - url: https://example.com/api/ping
    expect_status: 204
```

## Running

    python -m pinger

For running it under systemd, see the [deployment guide](docs/deploy.md).
For alert routing, see [operations](docs/operations.md).
