import { db } from "../db";

export async function searchBooks(query: string) {
  return db.book.findMany({
    where: { title: { contains: query, mode: "insensitive" } },
    take: 50,
  });
}
