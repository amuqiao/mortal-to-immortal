## 项目管理总则

这个仓库是 HTML + TypeScript/JavaScript + Phaser 3 + Vite + CrazyGames 的 H5 游戏工程骨架。Agent 管理项目时，优先维护“可复制、可验证、可提交审核”的工程链路，而不是只让当前 demo 跑起来。

做任何非平凡改动前，先按任务范围读取入口文档：

- 项目整体、命令和目录：`README.md`
- 脚本分层和新增脚本范式：`scripts/README.md`
- 架构边界：`docs/architecture.md`
- 生命周期、暂停、广告和平台监听：`docs/runtime-lifecycle.md`
- 模板经验回流边界：`docs/template-hardening.md`
- 上传前 QA：`docs/qa-checklist.md`
- CrazyGames 提交：`docs/crazygames-submit-checklist.md`

## 项目结构边界

- `src/main.ts` 负责浏览器启动、平台初始化和 DOM 外壳，不承载玩法规则。
- `src/platform/` 负责 Web/CrazyGames 平台适配，游戏代码不要直接访问 `window.CrazyGames`。
- `src/game/core/` 只放可在 Node 测试的纯规则，不依赖 Phaser、DOM、SDK 或浏览器 API。
- `src/game/scenes/` 负责编排 Phaser 场景、对象生命周期和场景跳转。
- `src/game/scenes/contracts.ts` 是场景 key 和场景 payload 的真源，不要在其他文件另建场景 key 真源。
- `src/game/ui/`、`src/game/effects/` 放可复用的 Phaser UI、音效和手感辅助。
- `scripts/` 放项目自动化脚本；新增脚本先做单一职责叶子脚本，再考虑 npm 别名。
- `docs/` 放长期维护文档、QA、提交记录、架构说明和已整理资料；临时分析不要混入正式文档。
- `docs/notes/` 放已经整理为长期可引用的资料或外部文档导出结果；每篇资料优先使用独立子目录，图片放同目录 `assets/`。
- 根目录 `notes/` 放临时分析、调研草稿、外部资料导入暂存和 agent 工作稿；不作为长期事实源，稳定结论应整理进 `docs/notes/`、`docs/`、`README.md` 或 `AGENTS.md`。
- `materials/` 放商店元数据、截图、封面和视频素材草稿；提交前必须替换模板 TODO。
- `submissions/`、`dist/`、`.run/` 是生成产物或本地运行态目录，除非用户明确要求，不要手动编辑其中内容。

## Agent 工作流程

- 接到任务后先判断改动类型：源码、脚本、文档、素材、提交准备、上传包准备或导出资料。
- 修改源码时优先沿用现有分层，不把平台、场景、纯规则和 DOM 职责混在一起。
- 修改场景跳转或结果数据时，同步 `src/game/scenes/contracts.ts` 和 `src/game/scenes/transition.ts`。
- 修改脚本时保持 `package.json` 简洁；复杂逻辑放到 `scripts/*.mjs` 或叶子脚本，并在 `scripts/README.md` 记录稳定入口。
- 修改长期文档时同步入口链接和相关说明，避免新增没人维护的平行 notes。
- 使用根目录 `notes/` 暂存资料时，应保持“一篇资料一个子目录，图片放同目录 `assets/`”；资料转为长期可引用后，再迁移到 `docs/notes/`。
- 修改 CrazyGames、广告、暂停、存档、上传目录或 Portal 相关逻辑时，同时检查 `docs/runtime-lifecycle.md`、`docs/qa-checklist.md` 和 `docs/crazygames-submit-checklist.md` 是否需要更新。
- 添加或移动素材时，同步 `docs/asset-license.csv` 或说明授权来源；不要把未确认授权的素材当正式素材使用。
- 只在用户明确要求时提交、打包或准备上传目录。

## 语言与写作规则

- 面向用户和维护者的仓库文本默认使用中文，包括 `README.md`、`docs/`、`notes/`、`materials/`、脚本说明、任务说明和总结。
- 代码注释默认使用中文；只有库 API 名称、协议名、错误码、第三方平台术语或已有英文上下文要求一致时，才使用英文。
- 代码标识符、命令、路径、包名、配置 key、npm script 名称和外部产品名保留英文原文。
- 新增或重写文档前，先检查同目录已有语言风格；如果没有强约束，优先写中文，不要默认生成英文模板。
- 如果必须保留英文内容，需要在回复中说明原因，例如外部平台要求、上游模板原文、代码生态惯例或避免破坏既有公开接口。

## 本地命令发现规则

- `package.json` 是可执行命令入口，不是 agent 行为规则全集；不要把其中所有脚本复制到本文。
- 需要了解某个本地脚本的完整参数时，优先运行该脚本的 `-h` 或 `--help`。
- 面向用户总结工具用法时，优先引用稳定 npm 入口；只有调试脚本本身时才直接调用 `node scripts/*.mjs` 或 `bash scripts/*.sh`。

## 常用验证命令

按改动范围选择最小必要验证：

- 通用测试：`npm test`
- 类型检查：`npm run typecheck`
- 完整构建：`npm run build`
- 依赖边界检查：`npm run check:boundaries`
- 脚本语法检查：`bash -n scripts/run.sh`、`bash -n scripts/dev.sh`

无法运行验证时，必须说明具体原因和剩余风险。

## 语雀文档导出

当用户要求导出已授权的语雀文档时，使用本项目脚本：

```bash
npm run yuque:export -- -h
npm run yuque:export -- '<语雀文档URL>' --dry-run --json
npm run yuque:export -- '<语雀文档URL>'
```

规则：

- 只导出用户明确拥有或已获授权的语雀文档。
- 正式导出前，优先先跑 `--dry-run --json`，确认标题、输出目录、图片数量和覆盖风险。
- 默认输出到 `docs/notes/<name>/<name>.md`，图片放在同一文档目录下的 `assets/` 或用户指定的 `--assets-dir`。
- 默认生成的目录名和文章文件名会清洗特殊字符；需要稳定名称时显式传入 `--name` 和 `--file`。
- 不要主动使用 `--force`；只有用户明确要求覆盖，或已经确认目标目录可以替换时，才加 `--force`。
- 需要自定义目录或文件名时，优先使用 `--out`、`--name`、`--file`、`--assets-dir`，不要手动移动导出结果。
- 需要查看完整参数时，以 `npm run yuque:export -- -h` 为准。

## Git 规则

- 提交必须保持单一意图，不混入无关改动；跨主题改动应拆分提交。
- 提交前确认改动范围、提交主题、入口文档或规则文件同步情况。
- 提交前完成最小必要验证；无法验证时说明原因和剩余风险。
- 提交信息默认使用中文；无仓库规范时优先使用 Conventional Commits，例如 `docs:`、`feat:`、`fix:`、`refactor:`、`chore:`。
- 提交信息优先写“改了什么”和对象，不写空泛标题。
- 只在用户明确要求时提交；非明确要求下不做 `amend`，不改写历史。
