#!/usr/bin/env node
import { exportCsv } from '../src/exporter/csv.js';

const [, , out = 'laporan.csv'] = process.argv;
await exportCsv(out, { delimiter: ';' });
