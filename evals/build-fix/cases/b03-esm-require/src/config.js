const fs = require("node:fs");

export function loadConfig(path) {
  const raw = fs.readFileSync(path, "utf8");
  return { port: 3000, ...JSON.parse(raw) };
}
