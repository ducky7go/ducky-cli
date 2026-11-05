# ducky-cli

## 项目概述

`@ducky7go/ducky-cli`（命令名 `ducky`）是一个 TypeScript/Node.js 命令行工具，用于把《Escape from Duckov》的游戏模组打包为 `.nupkg` 并发布到 NuGet 服务器，或发布到 Steam 创意工坊。打包格式遵循 `ducky7go/dukcy-package-spec`；GitHub Action `ducky7go/action-ducky-nuget` 在 CI 中通过 `npx -y @ducky7go/ducky-cli` 调用本工具。README 与 `docs/` 为中文。

## 目录结构

- `src/cli.ts` - 入口，用 `commander` 注册 `nuget` 与 `steam` 两个命名空间。
- `src/commands/nuget/`（pack、push、validate）与 `src/commands/steam/`（push、validate、list、info、subscribed、link、pull、delete）。
- `src/formats/nuget/` - `parser.ts`（info.ini）、`validator.ts`、`collector.ts`、`nuspec.ts`、`client.ts`（nuget.exe 的查找、下载、执行）。
- `src/formats/steam/` - 创意工坊逻辑（如 `push-handler.ts`、`workshop.ts`、`config.ts`、`bbcode.ts`、`validator.ts`）。
- `src/templates/nuspec.template`；`src/utils/`（config、fs、logger、errors、version）；`src/types/modules.d.ts`。
- `bin/ducky` - 包装脚本，运行 `dist/cli.js`（需先构建）。
- `test/unit/*.test.ts`、`test/integration/`、`test/fixtures/`（合法与非法模组样例）、`test/unit.test.ts`。
- `mods/` - 供手工验证的示例模组（`DisplayItemValue`、`Newbe.HurtToWarm`、`steam-multi-dll-one-matches`）。
- `docs/nuget.md`、`docs/steam.md` - 用户文档。
- `push-mod.sh <mod-name> <nuget|steam> [options] [--prod]` - 用 `mods/<mod-name>` 做本地推送（`--prod` 改用 npm 发布的版本）；`test-pack.sh` - 打包并解压 `mods/` 下所有模组用于检查。

## 构建 / 测试 / 运行

`package.json` 中的脚本：
- `pnpm run build` - `tsc`，输出到 `dist/`（ESM，`"type": "module"`）。
- `pnpm test` - `vitest --run`（匹配 `test/**/*.test.ts`）；另有 `pnpm run test:watch`、`pnpm run test:coverage`。
- `pnpm run dev` - `tsx src/cli.ts`；`pnpm run lint` - `eslint src`；`pnpm run format` - `prettier --write src`。
- 格式规则见 `.prettierrc.json`：单引号、分号、printWidth 100、2 空格、trailingComma es5。CI 中的格式检查已被注释掉，lint 也不在 PR 检查里。
- 运行构建产物：`node dist/cli.js <args>` 或 `bin/ducky`。
- 环境变量：`.env.example` 提供 `NUGET_API_KEY`、`NUGET_SERVER`；`STEAM_APP_ID` 只在 README 中提到。`.env` 已被 gitignore，绝不要提交或打印其内容。

## 约定

- ESM：源码内相对导入带 `.js` 后缀（见 `src/cli.ts`）；`tsconfig` 为 `strict`。
- 配置优先级：
  - NuGet（`src/utils/config.ts`）：CLI 参数 > 环境变量 > 默认值。`.duckyrc` 不参与 NuGet。
  - Steam：`--app-id` > `STEAM_APP_ID` > `.duckyrc` > 默认 `3167020`；可见性 `--visibility` > `.duckyrc` 的 `steam.visibility` > `public`；标签 `--tags` > `info.ini` 的 `tags` > `.duckyrc` 的 `steam.tags`，高优先级整体替换，不合并。`.duckyrc` 从当前目录向上查找，其次是用户主目录。
- 版本：`GitVersion.yml`（main 为 ContinuousDelivery，label `dev`）。CI 用 `npm version <version> --no-git-tag-version` 覆盖 `package.json`，因此其中的 `0.0.1` 只是占位。
- 发布（`publish.yml`）：`v*` 标签发布到 npm 的 `latest`；main 上未打标签的提交发布到 `dev` 标签。`deploy` 作业只在 `ducky7go/ducky-cli` 仓库内运行。
- 提交信息使用 conventional commits（如 `fix(cli): ...`、`docs(steam): ...`）。
- 行为或规范变更遵循 OpenSpec 工作流程。

## 注意事项

- `dist/`、`node_modules`、`.env`、`mods_unzip`、`pkg`、`coverage` 均被 gitignore，不要提交构建产物。
- NuGet 打包依赖 nuget.exe：`client.ts` 在非 Windows 上通过 `mono` 运行，找不到时从 `https://dist.nuget.org/win-x86-commandline/latest/nuget.exe` 下载；Linux/macOS 需要安装 Mono。
- `bin/ducky` 只运行 `dist/cli.js`，改源码后要先 `pnpm run build`（或用 `pnpm run dev`）。
- `publish.yml` 的作业使用 `submodules: recursive`，但仓库没有 `.gitmodules`。
- Node 版本：`pr-check.yml` 用 Node 18，`publish.yml` 用 Node 24，`package.json` 声明 `engines.node >=18`。

## 相关仓库

- `ducky7go/dukcy-package-spec` - NuGet 模组打包规范（本工具实现它）。
- `ducky7go/action-ducky-nuget` - 封装本 CLI 的 GitHub Action。
- Steam 发布依赖 npm 包 `@ducky7go/steamworks.js`。
