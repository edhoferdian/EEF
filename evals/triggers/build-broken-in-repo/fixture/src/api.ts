export async function getJson(path: string) {
  // API_BASE is required in every environment.
  const base: string = process.env.API_BASE;
  const res = await fetch(base + path);
  return res.json();
}
