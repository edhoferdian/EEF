#!/usr/bin/env node
const config = require('./config');

async function main() {
  const res = await fetch(`${config.erpUrl}/api/stock`, {
    headers: { authorization: `Bearer ${config.erpToken}` },
  });
  console.log(await res.json());
}

main();
