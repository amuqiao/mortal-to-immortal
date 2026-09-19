# 视频抠图裁剪工具

这是一个本地运行的 Vite Web 工具，用于处理视频素材抠图、裁剪和导出。它作为 Codex skill 的资源文件维护，位置是：

```text
.codex/skills/video-cutout-cropper/assets/video-cutout-cropper/
```

## 功能

- 上传本地视频素材。
- 使用色度键控、AI 人像分割或背景差分进行抠图。
- 调整裁剪区域和处理参数。
- 导出适合游戏素材整理流程使用的结果。

## 安装依赖

```bash
cd .codex/skills/video-cutout-cropper/assets/video-cutout-cropper
npm ci
```

## 本地运行

```bash
npm run dev
```

也可以从仓库根目录运行：

```bash
.codex/skills/video-cutout-cropper/scripts/run-dev.sh
```

默认端口由 Vite 决定；通过 skill 脚本运行时默认使用 `5174`，可以用 `PORT` 覆盖：

```bash
PORT=5180 .codex/skills/video-cutout-cropper/scripts/run-dev.sh
```

## 构建检查

```bash
npm run build
```

也可以从仓库根目录运行：

```bash
.codex/skills/video-cutout-cropper/scripts/build.sh
```

## 输出管理

- 不提交 `node_modules/`、`dist/`、`.vite/`。
- 不提交导入视频、大体积中间文件或临时导出文件。
- 最终要进入游戏的素材放到游戏项目约定目录，例如 `materials/` 或 `src/assets/`。
- 临时试验文件优先放 `.data/` 或工具本地未跟踪目录。

## 维护说明

这是一个独立小工具项目。改造 UI、参数面板、抠图逻辑、裁剪逻辑或导出逻辑时，优先修改 `src/` 内源码；不要把工具逻辑拆散到游戏项目根目录。
