import { copyFile, cp, mkdir, rm, chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const getOption = (name, fallback = null) => {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return fallback;
};

const outRoot = path.resolve(getOption('--out-dir', 'dist/portable'));
const platform = process.platform === 'darwin' ? 'macos' : (process.platform === 'win32' ? 'win' : process.platform);
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const label = getOption('--label', `${platform}-${arch}`);
const packageDir = path.join(outRoot, label);

const main = async () => {
  await rm(packageDir, { recursive: true, force: true });
  await mkdir(packageDir, { recursive: true });

  // Runtime node binary
  const runtimeDir = path.join(packageDir, 'runtime');
  await mkdir(runtimeDir, { recursive: true });
  const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
  const runtimeNode = path.join(runtimeDir, nodeName);
  await copyFile(process.execPath, runtimeNode);
  if (process.platform !== 'win32') {
    await chmod(runtimeNode, 0o755);
  }

  // App files
  await cp(path.resolve('bin'), path.join(packageDir, 'bin'), { recursive: true });
  await cp(path.resolve('src'), path.join(packageDir, 'src'), { recursive: true });
  await cp(path.resolve('netron/source'), path.join(packageDir, 'netron', 'source'), { recursive: true });
  await cp(path.resolve('samples'), path.join(packageDir, 'samples'), { recursive: true });

  // Launchers
  if (process.platform === 'win32') {
    const launcher = `@echo off\r\nset DIR=%~dp0\r\n"%DIR%runtime\\node.exe" "%DIR%bin\\netron-cli.mjs" %*\r\n`;
    await writeFile(path.join(packageDir, 'netron-cli.portable.cmd'), launcher, 'utf-8');
  } else {
    const launcher = `#!/usr/bin/env sh\nDIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\nexec "$DIR/runtime/node" "$DIR/bin/netron-cli.mjs" "$@"\n`;
    const launcherPath = path.join(packageDir, 'netron-cli.portable');
    await writeFile(launcherPath, launcher, 'utf-8');
    await chmod(launcherPath, 0o755);
  }

  process.stdout.write(`Portable package ready: ${packageDir}\n`);
};

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exit(1);
});
