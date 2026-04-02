import { cp, mkdir, rm, chmod, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const getOption = (name, fallback = null) => {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return fallback;
};

const run = (cmd, cmdArgs, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${cmd} exited with code ${code}`));
      }
    });
  });

const outRoot = path.resolve(getOption('--out-dir', 'dist/fused'));
const platform = process.platform === 'darwin' ? 'macos' : (process.platform === 'win32' ? 'win' : process.platform);
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const label = getOption('--label', `${platform}-${arch}`);
const packageDir = path.join(outRoot, label);
const stageDir = path.join(packageDir, '.stage');
const bundleName = 'netron-cli.fused.bundle.tgz';

const main = async () => {
  await rm(packageDir, { recursive: true, force: true });
  await mkdir(stageDir, { recursive: true });

  await mkdir(path.join(stageDir, 'runtime'), { recursive: true });
  const nodeName = process.platform === 'win32' ? 'node.exe' : 'node';
  await cp(process.execPath, path.join(stageDir, 'runtime', nodeName));
  if (process.platform !== 'win32') {
    await chmod(path.join(stageDir, 'runtime', nodeName), 0o755);
  }

  await cp(path.resolve('bin'), path.join(stageDir, 'bin'), { recursive: true });
  await cp(path.resolve('src'), path.join(stageDir, 'src'), { recursive: true });
  await cp(path.resolve('netron/source'), path.join(stageDir, 'netron', 'source'), { recursive: true });

  const bundlePath = path.join(packageDir, bundleName);
  await run('tar', ['-czf', bundlePath, '-C', stageDir, '.']);
  await rm(stageDir, { recursive: true, force: true });

  if (process.platform === 'win32') {
    const launcher = `@echo off\r\nsetlocal\r\nset DIR=%~dp0\r\nset CACHE=%TEMP%\\netron-cli-fused-${label}\r\nif not exist "%CACHE%\\bin\\netron-cli.mjs" (\r\n  rmdir /s /q "%CACHE%" >nul 2>nul\r\n  mkdir "%CACHE%"\r\n  tar -xzf "%DIR%${bundleName}" -C "%CACHE%"\r\n)\r\n"%CACHE%\\runtime\\node.exe" "%CACHE%\\bin\\netron-cli.mjs" %*\r\n`;
    await writeFile(path.join(packageDir, 'netron-cli.fused.cmd'), launcher, 'utf-8');
  } else {
    const launcher = `#!/usr/bin/env sh\nset -e\nDIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\nCACHE="${'${TMPDIR:-/tmp}'}/netron-cli-fused-${label}"\nif [ ! -f "$CACHE/bin/netron-cli.mjs" ]; then\n  rm -rf "$CACHE"\n  mkdir -p "$CACHE"\n  tar -xzf "$DIR/${bundleName}" -C "$CACHE"\nfi\nexec "$CACHE/runtime/node" "$CACHE/bin/netron-cli.mjs" "$@"\n`;
    const launcherPath = path.join(packageDir, 'netron-cli.fused');
    await writeFile(launcherPath, launcher, 'utf-8');
    await chmod(launcherPath, 0o755);
  }

  process.stdout.write(`Fused package ready: ${packageDir}\n`);
};

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exit(1);
});
