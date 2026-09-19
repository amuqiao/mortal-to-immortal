---
name: video-cutout-cropper
description: 使用或维护本地视频抠图裁剪 Web 工具。适用于用户要处理视频抠图、裁剪、透明背景素材导出、运行该工具或改造该工具时；不用于普通游戏逻辑开发或通用图片生成。
---

# Video Cutout Cropper

本 skill 封装一个本地 Vite Web 工具，用于辅助处理视频素材的抠图、裁剪和导出。工具源码位于：

```text
assets/video-cutout-cropper/
```

## 使用场景

在这些请求中使用本 skill：

- 用户要运行“视频抠图工具”“带裁剪功能的视频工具”。
- 用户要从视频中制作游戏素材、透明背景片段、裁剪后的素材。
- 用户要维护或改造该工具的 UI、交互、抠图参数、裁剪逻辑、导出逻辑。
- 用户询问这个工具的输入、输出、依赖恢复或本地启动方式。

不要把本 skill 用作通用素材生成或游戏功能开发入口。图片生成类任务优先使用更匹配的图片生成 skill；游戏源码功能改动按项目本身规则处理。

## 工具结构

```text
video-cutout-cropper/
|-- SKILL.md
|-- scripts/
|   |-- run-dev.sh
|   `-- build.sh
`-- assets/
    `-- video-cutout-cropper/
        |-- README.md
        |-- package.json
        |-- package-lock.json
        |-- index.html
        |-- vite.config.js
        |-- public/
        `-- src/
```

`assets/video-cutout-cropper/` 是可运行的小工具项目，不是说明文本。需要查看实现时再读取其中源码。

## 运行方式

优先使用 skill 脚本：

```bash
.codex/skills/video-cutout-cropper/scripts/run-dev.sh
.codex/skills/video-cutout-cropper/scripts/build.sh
```

如果依赖未安装，先进入工具目录执行：

```bash
cd .codex/skills/video-cutout-cropper/assets/video-cutout-cropper
npm ci
```

也可以直接在工具目录使用：

```bash
npm run dev
npm run build
```

## 产物规则

- 不提交 `node_modules/`、`dist/`、`.vite/`。
- 不把用户导入的视频、中间导出文件、大体积临时素材提交进 skill。
- 面向当前游戏的最终素材，放到项目约定的 `materials/`、`src/assets/` 或对应资源目录。
- 如果只是临时试验素材，优先放在 `.data/` 或工具自己的本地输出目录，并在完成后说明位置。

## 维护原则

- 先保持工具作为独立小项目运行，再考虑和游戏项目集成。
- 修改工具时优先在 `assets/video-cutout-cropper/` 内完成，不把实现散落到项目根目录。
- 新增命令入口时放到 `scripts/`，并让脚本从自身位置定位工具目录。
- 修改脚本后至少运行 `bash -n`；修改工具源码后至少运行 `npm run build`，如因依赖或网络限制无法运行，需要说明原因。
