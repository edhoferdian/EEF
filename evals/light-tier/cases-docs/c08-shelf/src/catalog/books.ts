import { db } from "../db";

const PAGE_SIZE = 20;

export async function getBook(id: string) {
  return db.book.findUnique({ where: { id } });
}

export async function listBooks({ authorId, cursor }: { authorId?: string; cursor?: string }) {
  return db.book.findMany({
    where: authorId ? { authorId } : {},
    take: PAGE_SIZE,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { id: "asc" },
  });
}

export async function addBook(input: { title: string; authorId: string }) {
  if (!input.title.trim()) throw new Error("title is required");
  return db.book.create({ data: { title: input.title.trim(), authorId: input.authorId } });
}
