import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { toGraphJson, toWeightsManifestJson } from './normalize.mjs';
import { openModel } from './parser.mjs';

const HELP = `
netron-cli: parse model with Netron and export LLM-friendly JSON

Usage:
  netron-cli inspect <model-path> [--json]
  netron-cli export graph <model-path> -o <file>
  netron-cli export weights <model-path> -o <file>
  netron-cli export all <model-path> --out-dir <dir>

Options:
  -o, --output <file>     Output file path
  --out-dir <dir>         Output directory for export all
  --json                  Print JSON to stdout
  --pretty <n>            JSON indent spaces (default: 2)
  -h, --help              Show help
`;

const fail = (message) => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const parsePretty = (args) => {
  const index = args.indexOf('--pretty');
  if (index === -1) {
    return 2;
  }
  const value = Number.parseInt(args[index + 1], 10);
  return Number.isInteger(value) && value >= 0 ? value : 2;
};

const optionValue = (args, ...names) => {
  for (const name of names) {
    const index = args.indexOf(name);
    if (index !== -1 && index + 1 < args.length) {
      return args[index + 1];
    }
  }
  return null;
};

const toJsonText = (payload, pretty) =>
  JSON.stringify(payload, (key, value) => (typeof value === 'bigint' ? value.toString() : value), pretty);

const writeJson = async (filePath, payload, pretty) => {
  await mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
  await writeFile(filePath, `${toJsonText(payload, pretty)}\n`, 'utf-8');
};

export const runCli = async () => {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes('-h') || argv.includes('--help')) {
    process.stdout.write(HELP);
    return;
  }

  const command = argv[0];
  const pretty = parsePretty(argv);

  if (command === 'inspect') {
    const input = argv[1];
    if (!input) {
      fail('Missing <model-path>.');
    }
    const { model, absolutePath } = await openModel(input);
    const summary = {
      format: model.format || null,
      producer: model.producer || null,
      runtime: model.runtime || null,
      identifier: model.identifier || null,
      source_path: absolutePath,
      graph_count: Array.isArray(model.modules) ? model.modules.length : 0
    };

    if (argv.includes('--json')) {
      process.stdout.write(`${toJsonText(summary, pretty)}\n`);
    } else {
      process.stdout.write(`format: ${summary.format || 'unknown'}\n`);
      process.stdout.write(`producer: ${summary.producer || 'unknown'}\n`);
      process.stdout.write(`runtime: ${summary.runtime || 'unknown'}\n`);
      process.stdout.write(`identifier: ${summary.identifier || 'unknown'}\n`);
      process.stdout.write(`source: ${summary.source_path}\n`);
      process.stdout.write(`graphs: ${summary.graph_count}\n`);
    }
    return;
  }

  if (command === 'export') {
    const target = argv[1];
    const input = argv[2];
    if (!target || !input) {
      fail('Usage: netron-cli export <graph|weights|all> <model-path> ...');
    }

    const { model, absolutePath } = await openModel(input);

    if (target === 'graph') {
      const output = optionValue(argv, '-o', '--output');
      if (!output) {
        fail('Missing output path. Use -o <file>.');
      }
      const graph = toGraphJson(model, absolutePath);
      await writeJson(output, graph, pretty);
      process.stdout.write(`Wrote graph JSON: ${path.resolve(output)}\n`);
      return;
    }

    if (target === 'weights') {
      const output = optionValue(argv, '-o', '--output');
      if (!output) {
        fail('Missing output path. Use -o <file>.');
      }
      const manifest = toWeightsManifestJson(model, absolutePath);
      await writeJson(output, manifest, pretty);
      process.stdout.write(`Wrote weights manifest: ${path.resolve(output)}\n`);
      return;
    }

    if (target === 'all') {
      const outDir = optionValue(argv, '--out-dir');
      if (!outDir) {
        fail('Missing output dir. Use --out-dir <dir>.');
      }
      const graph = toGraphJson(model, absolutePath);
      const manifest = toWeightsManifestJson(model, absolutePath);
      await mkdir(path.resolve(outDir), { recursive: true });
      await writeJson(path.join(outDir, 'graph.json'), graph, pretty);
      await writeJson(path.join(outDir, 'weights_manifest.json'), manifest, pretty);
      process.stdout.write(`Wrote export files under: ${path.resolve(outDir)}\n`);
      return;
    }

    fail(`Unknown export target '${target}'.`);
  }

  fail(`Unknown command '${command}'. Use --help.`);
};
