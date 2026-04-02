import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { FileStream } from '../netron/source/node.js';

const SRC_DIR = path.dirname(fileURLToPath(import.meta.url));

const resolveNetronSourceDir = () => {
  const candidates = [];
  if (process.env.NETRON_SOURCE_DIR) {
    candidates.push(path.resolve(process.env.NETRON_SOURCE_DIR));
  }
  if (process.pkg) {
    candidates.push(path.resolve(path.dirname(process.execPath), 'netron', 'source'));
    candidates.push(path.resolve(process.cwd(), 'netron', 'source'));
    candidates.push(path.resolve(SRC_DIR, '..', 'netron', 'source'));
  } else {
    candidates.push(path.resolve(SRC_DIR, '..', 'netron', 'source'));
    candidates.push(path.resolve(path.dirname(process.execPath), 'netron', 'source'));
    candidates.push(path.resolve(process.cwd(), 'netron', 'source'));
  }
  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir;
    }
  }
  return candidates[0];
};

const NETRON_SOURCE_DIR = resolveNetronSourceDir();

export class CliHost {
  constructor() {
    this._errors = [];
  }

  get type() {
    return 'CLI';
  }

  get errors() {
    return this._errors;
  }

  environment(name) {
    const env = {
      platform: process.platform,
      serial: true
    };
    return env[name];
  }

  event() {}

  update() {}

  async require(id) {
    const resolved = id.endsWith('.js') ? id : `${id}.js`;
    const file = path.resolve(NETRON_SOURCE_DIR, resolved);
    return import(pathToFileURL(file).href);
  }

  async asset(file) {
    return this.fetch(file, 'utf-8', null);
  }

  async fetch(file, encoding, baseDir) {
    const root = baseDir || NETRON_SOURCE_DIR;
    const filePath = path.resolve(root, file);
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      throw new Error(`The path '${file}' is a directory.`);
    }
    if (encoding) {
      return readFile(filePath, encoding);
    }
    return new FileStream(filePath, 0, fileStat.size, fileStat.mtimeMs);
  }

  exception(error) {
    this._errors.push(error);
  }

  message() {}
}

export class CliContext {
  constructor(host, folder, identifier, stream, entries = new Map()) {
    this._host = host;
    this._folder = folder;
    this._identifier = identifier;
    this._stream = stream;
    this._entries = entries;
  }

  get identifier() {
    return this._identifier;
  }

  get stream() {
    return this._stream;
  }

  get entries() {
    return this._entries;
  }

  async asset(file) {
    return this._host.asset(file);
  }

  async fetch(file, encoding, base) {
    return this._host.fetch(file, encoding, base === undefined ? this._folder : base);
  }

  async require(id) {
    return this._host.require(id);
  }

  error(error) {
    this._host.exception(error);
  }
}
