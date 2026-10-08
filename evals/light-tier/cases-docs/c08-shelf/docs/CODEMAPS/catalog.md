# Codemap — Catalog

Last Updated: 2026-09-21

## src/catalog/books.ts

Reads and writes book records.

Exports:
- `getBook(id)` — one book or `null`
- `listBooks({ authorId, cursor })` — a page of books, 20 per page
- `addBook(input)` — validates and inserts a book

## src/catalog/authors.ts

Exports:
- `getAuthor(id)` — one author or `null`
- `renameAuthor(id, name)` — updates the display name

## src/catalog/search.ts

Exports:
- `searchBooks(query)` — case-insensitive title search, at most 50 results
