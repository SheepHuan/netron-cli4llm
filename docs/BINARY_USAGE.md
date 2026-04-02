# NetronCli 二进制使用指南

本文档说明拿到二进制包后，如何在未安装 Node.js 的机器上使用 `netron-cli`。

## 先选包类型

- `portable`：目录直跑，方便排查问题
- `fused`：分发更集中，首次运行会自动解包到临时目录

## 启动方式

假设你已经解压并进入产物目录：

- macOS / Linux
  - Portable: `./netron-cli.portable --help`
  - Fused: `./netron-cli.fused --help`
- Windows (CMD / PowerShell)
  - Portable: `.\netron-cli.portable.cmd --help`
  - Fused: `.\netron-cli.fused.cmd --help`

## 常用命令

以启动器替代 `node ./bin/netron-cli.mjs` 即可：

```bash
<launcher> inspect <model-path> [--json]
<launcher> export graph <model-path> -o graph.json
<launcher> export weights <model-path> -o weights_manifest.json
<launcher> export all <model-path> --out-dir out/
```

示例（macOS / Linux，Portable）：

```bash
./netron-cli.portable inspect ./samples/onnx/squeezenet1.0-3.onnx --json
./netron-cli.portable export all ./samples/onnx/squeezenet1.0-3.onnx --out-dir ./out/sample
```

## 输出说明

- `graph.json`：模型结构（graph / node / edge / tensor type）
- `weights_manifest.json`：参数索引（默认不展开参数值）

## Fused 模式补充

- 首次运行会把 `netron-cli.fused.bundle.tgz` 解包到系统临时目录
- 之后重复运行会复用缓存，加快启动
- 删除临时目录缓存后会在下一次运行时自动重新解包

## 故障排查

- 运行提示无执行权限（macOS / Linux）：
  - `chmod +x ./netron-cli.portable` 或 `chmod +x ./netron-cli.fused`
- 模型路径报错：
  - 优先改用绝对路径，确认文件可读
- Fused 启动异常：
  - 清理临时目录中的 `netron-cli-fused-*` 缓存后重试
