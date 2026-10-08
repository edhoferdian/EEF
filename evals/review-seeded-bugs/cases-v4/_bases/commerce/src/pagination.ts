export interface Page {
  take: number;
  skip: number;
}

export function page(query: Record<string, unknown>): Page {
  const limit = Number(query.limit ?? 20);
  const offset = Number(query.offset ?? 0);
  return {
    take: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20,
    skip: Number.isInteger(offset) && offset >= 0 ? offset : 0,
  };
}
