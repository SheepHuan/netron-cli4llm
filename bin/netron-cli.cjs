#!/usr/bin/env node

(async () => {
  const { runCli } = await import('../src/main.mjs');
  await runCli();
})().catch((error) => {
  process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
  process.exit(1);
});
