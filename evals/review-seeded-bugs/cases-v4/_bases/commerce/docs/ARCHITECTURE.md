# commerce-api architecture

The API serves many stores from one database. These rules hold for every
resource module under src/modules/.

1. **Store scoping.** Every query on a store-owned table filters by
   `storeId: req.store.id`. Never take a store id from the body or query.
2. **Soft delete.** Rows are never removed: deleting sets `deletedAt`.
   Every read (list, get, count, search) filters `deletedAt: null`.
3. **Pagination.** List endpoints take `limit`/`offset` only through
   `page(req.query)` in src/pagination.ts, which caps `limit` at 100.
4. **Money.** Amounts are integer cents (`...Cents` fields). Query
   parameters that are money are given in cents, never dollars.
5. **Logging.** Never log personal data (email, name, phone, address).
   Log ids only.
6. **Input.** Validate every body field's type and bounds before writing.
