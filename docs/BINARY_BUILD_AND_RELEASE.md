# NetronCli 二进制构建与分发指南

本文档说明如何在发布机上构建 `netron-cli` 二进制产物，并用于分发。

## 目标

- 让目标机器无需安装 Node.js 即可运行 `netron-cli`
- 产出两类可分发包：`portable` 与 `fused`

## 前置条件

- 构建机已安装 Node.js 18+
- 仓库已包含 `netron` submodule 内容

如果是首次拉取仓库：

```bash
git clone --recurse-submodules <your-repo-url>
```

如果仓库已存在但未拉取 submodule：

```bash
git submodule update --init --recursive
```

## 本地构建

```bash
npm install
npm run package:portable
npm run package:fused
```

## 产物结构

默认输出目录：

- `dist/portable/<platform>-<arch>/`
- `dist/fused/<platform>-<arch>/`

其中：

- `platform`：`linux` / `macos` / `win`
- `arch`：`x64` / `arm64`

### Portable 模式

目录直跑，适合调试和故障排查。

- 启动器：`netron-cli.portable`（Windows: `netron-cli.portable.cmd`）
- 内置运行时：`runtime/node`（Windows: `runtime/node.exe`）
- 业务文件：`bin/`、`src/`、`netron/source/`、`samples/`

### Fused 模式

分发文件更集中，启动时自动解包到临时目录后执行。

- 启动器：`netron-cli.fused`（Windows: `netron-cli.fused.cmd`）
- Bundle：`netron-cli.fused.bundle.tgz`

## 自定义输出目录或标签

```bash
npm run package:portable -- --out-dir dist/portable --label linux-x64
npm run package:fused -- --out-dir dist/fused --label linux-x64
```

- `--out-dir`：产物根目录
- `--label`：平台标识目录名（默认按当前平台自动生成）

## 多平台分发建议

通过各平台原生 runner 构建对应包（例如 GitHub Actions 工作流 `.github/workflows/binary-release.yml`）：

- Linux x64 / arm64
- macOS x64 / arm64
- Windows x64

建议策略：

- 每个平台只分发在该平台构建出的包
- 发布时保留 `platform-arch` 标签，便于下载方选择
