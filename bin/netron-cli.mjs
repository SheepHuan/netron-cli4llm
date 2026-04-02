#!/usr/bin/env node

import { runCli } from '../src/main.mjs';

runCli().catch((error) => {
  process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
  process.exit(1);
});
