## OpenSpec

This repo has no `openspec/` directory. OpenSpec for all `ducky7go-mono` sub-repos lives in the parent repo: `../../openspec/` (workflow rules `../../openspec/AGENTS.md`, specs `../../openspec/specs/`, changes `../../openspec/changes/`). This repo's former project context is `../../openspec/projects/ducky-cli/project.md`.


# ducky-cli

## 项目概述

`@ducky7go/ducky-cli`（命令名 `ducky`）是一个 TypeScript/Node.js 命令行工具，用于把《Escape from Duckov》的游戏模组打包为 `.nupkg` 并发布到 NuGet 服务器，或发布到 Steam 创意工坊。打包格式遵循 `ducky7go/dukcy-package-spec`；GitHub Action `ducky7go/action-ducky-nuget` 在 CI 中通过 `npx -y @ducky7go/ducky-cli` 调用本工具。README 与 `docs/` 为中文。

## 目录结构

- `src/cli.ts` - 入口，基于 `commander` 注册命令命名空间（`nuget`、`steam`）。
- `src/commands/{nuget,steam}/` - 子命令：`nuget pack|push|validate`，`steam push|validate`。
- `src/formats/nuget/` - `parser.ts`（info.ini）、`validator.ts`、`collector.ts`、`nuspec.ts`、`client.ts`（nuget.exe 的查找/下载/执行）。
- `src/formats/steam/` - 创意工坊相关（`push-handler.ts`、`workshop.ts`、`validator.ts` 等）。
- `src/templates/nuspec.template`、`src/utils/`（config、fs、logger、errors、version）。
- `bin/ducky` - 包装脚本，启动 `dist/cli.js`（需先构建）。
- `test/unit`、`test/integration`、`test/fixtures`（各类合法/非法模组样例）；`mods/` - 供手工验证的示例模组。
- `docs/nuget.md`、`docs/steam.md` - 用户文档。
- `../../openspec/specs/` - 已有能力规格（cli-nuget-pack、cli-nuget-push、cli-steam-push、path-handling、ci-pr-check 等）；`../../openspec/changes/archive/` - 已归档变更。
- `push-mod.sh <mod-name> <nuget|steam> [options] [--prod]` - 用 `mods/<mod-name>` 本地推送；`test-pack.sh` - 打包并解压所有 `mods/` 用于检查。

## 构建 / 测试 / 运行

`package.json` 中的脚本：
- `pnpm run build` - `tsc`，输出到 `dist/`（ESM，`"type": "module"`）。
- `pnpm test` - `vitest --run`（`test/**/*.test.ts`）；`pnpm run test:watch`、`pnpm run test:coverage` 也存在。
- `pnpm run dev` - `tsx src/cli.ts`。
- `pnpm run lint` - `eslint src`；`pnpm run format` - `prettier --write src`（`.prettierrc.json`：单引号、分号、printWidth 100、2 空格）。
- 运行已构建版本：`node dist/cli.js <args>` 或 `bin/ducky`。
- `.env.example` 提供 `NUGET_API_KEY`、`NUGET_SERVER`；README 还提到 `STEAM_APP_ID`。`.env` 已被 gitignore，绝不要提交或打印其内容。

## 约定

- ESM：源码内相对导入带 `.js` 后缀（见 `src/cli.ts`）；`tsconfig` 为 `strict`。
- 配置优先级（`src/utils/config.ts`）：CLI 参数 > 环境变量 > 默认值（`.duckyrc` 仅在注释中，未实现）。
- 版本：`GitVersion.yml`（main 为 ContinuousDelivery，`dev` 标签）。CI 发布时用 `npm version <version> --no-git-tag-version` 覆盖 `package.json` 版本，因此其中的 `0.0.1` 仅是占位。
- CI：`pr-check.yml`（PR 到 main：`pnpm install --frozen-lockfile`、`pnpm run build`、`pnpm test`，Node 18）；`publish.yml`（`v*` 标签发布到 npm 的 `latest`，main 上未打标签的提交发布到 `dev` 标签；检查/构建用 Node 24，需 `ducky7go/ducky-cli` 仓库本身才会部署）；`release-drafter.yml`。
- 提交信息：`git log` 可见 conventional commits 与 PR 编号（如 `better description for nuget (#12)`），仅有 1 条浅克隆历史可参考。
- 较大变更走 OpenSpec（见上方 OpenSpec 说明）。

## 注意事项

- `dist/`、`node_modules`、`.env`、`mods_unzip`、`pkg`、`coverage` 均被 gitignore，不要提交构建产物。
- NuGet 打包依赖 nuget.exe：`client.ts` 在非 Windows 上通过 `mono` 运行，找不到时从 `dist.nuget.org` 下载；在 Linux/macOS 上需要安装 Mono。
- `bin/ducky` 只运行 `dist/cli.js`，开发时要先 `pnpm run build`（或用 `pnpm run dev`）。
- `../../openspec/projects/ducky-cli/project.md` 仍是未填写的模板，不含项目信息。
- 两个 CI 工作流使用 `submodules: recursive`，但仓库没有 `.gitmodules`。
- `pr-check.yml` 使用 Node 18，`publish.yml` 使用 Node 24，`package.json` 声明 `engines.node >=18`。

## 相关仓库

- `ducky7go/dukcy-package-spec` - NuGet 模组打包规范（本工具实现它）。
- `ducky7go/action-ducky-nuget` - 封装本 CLI 的 GitHub Action。
- Steam 发布依赖 npm 包 `@ducky7go/steamworks.js`。
