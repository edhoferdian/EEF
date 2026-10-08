# Larkspur Geocoding API — Rate limits

Published: 2024-03-02

| Plan | Requests per minute | Requests per day |
|---|---|---|
| Free | 100 | 10,000 |
| Starter | 600 | 100,000 |
| Business | 3,000 | unlimited |

Requests over the limit receive HTTP 429 with a `Retry-After` header.
