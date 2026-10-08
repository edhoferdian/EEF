#!/usr/bin/env node
import { parseArgs } from "node:util";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { compress } from "../src/compress.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: "string", short: "o", default: "./out" },
    quality: { type: "string", short: "q", default: "80" },
    format: { type: "string" },
  },
});

if (positionals.length === 0) {
  console.error("usage: shrink <files...> [options]");
  process.exit(2);
}

await mkdir(values.output, { recursive: true });
for (const file of positionals) {
  const dest = path.join(values.output, path.basename(file));
  await compress(file, dest, { quality: Number(values.quality), format: values.format });
  console.log(`${file} -> ${dest}`);
}
