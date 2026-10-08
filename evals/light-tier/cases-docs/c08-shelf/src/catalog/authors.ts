import { db } from "../db";

export async function getAuthor(id: string) {
  return db.author.findUnique({ where: { id } });
}

export async function renameAuthor(id: string, name: string) {
  return db.author.update({ where: { id }, data: { name } });
}
