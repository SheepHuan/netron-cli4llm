import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { FileStream } from '../netron/source/node.js';
import { ModelFactoryService } from '../netron/source/view.js';
import { CliContext, CliHost } from './cli-host.mjs';

const toPosix = (value) => value.split(path.sep).join(path.posix.sep);

const walkFiles = async (rootDir) => {
  const entries = new Map();
  const walk = async (currentDir) => {
    const dirents = await readdir(currentDir, { withFileTypes: true });
    for (const dirent of dirents) {
      const fullPath = path.join(currentDir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(fullPath);
      } else if (dirent.isFile()) {
        const info = await stat(fullPath);
        const rel = toPosix(path.relative(rootDir, fullPath));
        entries.set(rel, new FileStream(fullPath, 0, info.size, info.mtimeMs));
      }
    }
  };
  await walk(rootDir);
  return entries;
};

export const openModel = async (inputPath) => {
  const absolutePath = path.resolve(inputPath);
  const info = await stat(absolutePath);

  const host = new CliHost();
  let context = null;

  if (info.isFile()) {
    const stream = new FileStream(absolutePath, 0, info.size, info.mtimeMs);
    context = new CliContext(host, path.dirname(absolutePath), path.basename(absolutePath), stream, new Map());
  } else if (info.isDirectory()) {
    const entries = await walkFiles(absolutePath);
    context = new CliContext(host, absolutePath, path.basename(absolutePath), null, entries);
  } else {
    throw new Error(`Unsupported input path type: '${inputPath}'.`);
  }

  const service = new ModelFactoryService(host);
  const model = await service.open(context);

  if (!model) {
    throw new Error('Netron failed to open model.');
  }

  return { model, context, absolutePath };
};
