# 支持 Steam 平台发布功能（通过 steamworks.js）

## Status
**ExecutionCompleted**

## Overview

为 Ducky CLI 添加通过 steamworks.js 库发布游戏到 Steam 平台的功能。这将扩展 CLI 的发布平台支持范围，允许开发者使用统一的命令接口发布到 NuGet 和 Steam 两个平台。

## Why

Ducky CLI 当前仅支持 NuGet 平台发布。开发者需要手动使用 Steamworks 工具或编写自定义脚本来完成 Steam 创意工坊发布流程，这增加了开发负担并降低了发布效率。

通过添加 Steam Workshop 发布支持，开发者可以：
- 使用统一的 CLI 工具发布到多个平台（NuGet + Steam）
- 减少手动操作和潜在错误
- 保持与现有 NuGet 发布工作流一致的学习曲线

## What Changes

本变更添加以下新功能：

1. **新命令组**: `ducky steam` 命令命名空间
   - `ducky steam validate <path>` - 验证 Steam Workshop 发布配置
   - `ducky steam push <path>` - 推送内容到 Steam 创意工坊

2. **新依赖**: `@ducky7go/steamworks.js` - Steamworks SDK 的 Node.js 绑定

3. **新配置选项**:
   - 环境变量 `STEAM_APP_ID`（默认：3167020）
   - `info.ini` 中的 `publishedFileId` 属性（已存在于现有接口中）

4. **多语言描述支持**: 从 `description/*.md` 读取并转换多语言 Workshop 描述

详细的功能规格请参见：
- `specs/cli-steam-validate/spec.md` - 验证命令规格
- `specs/cli-steam-push/spec.md` - 推送命令规格

## Background

Ducky CLI 是一个命令行工具，用于简化游戏开发的构建和发布流程。当前项目已支持发布到 NuGet 平台（用于 mod 包管理），现在需要扩展支持 Steam 平台的游戏发布能力。

目前开发者需要手动使用 Steamworks 工具或编写自定义脚本来完成 Steam 发布流程，这增加了开发负担并降低了发布效率。通过引入 steamworks.js（Steamworks SDK 的 Node.js 绑定），我们可以提供与现有 NuGet 命令一致的用户体验。

## Goals

1. **平台扩展**: 添加 Steam 作为新的发布目标平台
2. **命令一致性**: 与现有 `ducky nuget` 命令保持类似的命令结构和用户体验
3. **配置验证**: 提供 Steam 发布所需配置的验证功能
4. **无缝集成**: 利用 steamworks.js 提供的原生 Steamworks SDK 功能

## Non-Goals

1. 完整的 Steamworks 功能封装（仅实现创意工坊发布所需的核心功能）
2. Steam Depot 上传（仅针对 Steam 创意工坊 Workshop 物品上传）
3. Steam 成就、云存档等高级功能
4. 多平台构建自动化（构建流程由用户自行管理）

## Proposed Solution

### 新增命名空间命令

添加 `ducky steam` 命令组，包含以下子命令：

```bash
ducky steam validate <path>    # 验证 Steam Workshop 发布配置
ducky steam push <path>         # 推送到 Steam 创意工坊
```

### 技术实现

1. **依赖库**: 使用 `@ducky7go/steamworks.js` 作为 Steamworks SDK 的 Node.js 绑定
2. **配置管理**: 扩展现有 `info.ini` 配置文件，支持 Steam App ID 和 publishedFileId 配置
3. **验证规则**: 验证创意工坊发布所需的配置和资源
4. **上传功能**: 使用 Steamworks SDK 的 Workshop API 将内容推送到 Steam 创意工坊

### 命令结构

```
ducky steam validate <path> [options]
  -v, --verbose           # 详细输出

ducky steam push <path> [options]
  --update-description    # 更新 Workshop 描述（从 description/*.md 读取多语言描述）
  --changelog <note>      # 更新日志（显示在 Steam 更新说明中）
  -v, --verbose           # 详细输出
```

### 元数据处理

Steam Workshop 发布需要处理物品描述的多语言支持，参考现有 C# 实现：

1. **多语言描述更新** (`--update-description`):
   - 扫描 `description/*.md` 目录
   - 根据文件名识别语言（如 `zh.md` → `schinese`, `en.md` → `english`, `japanese.md` → `japanese`）
   - 将 Markdown 内容转换为 Steam 支持的格式
   - **描述更新规则**：
     - **首次上传**（无 `publishedFileId`）：主语言的标题和描述**必然上传**
     - **后续更新**（有 `publishedFileId`）：
       - 带有 `--update-description`：更新**所有语言**的标题和描述（包括主语言）
       - 不带 `--update-description`：**不更新任何描述**（包括主语言也不更新）

2. **更新日志** (`--changelog`):
   - 作为 Steam Workshop 更新的说明文本
   - 显示在物品的更新历史中

3. **预览图片**:
   - 使用 `preview.png` 作为 Workshop 物品的预览图

4. **配置管理**:
   - 所有配置来自 `info.ini` 文件和环境变量，不创建额外的 `steam.ini`
   - `appId` 是固定的（默认 3167020），只能通过环境变量 `STEAM_APP_ID` 修改，不能在 info.ini 中添加
   - `publishedFileId` 是 `info.ini` 的顶级属性，已存在于现有结构中：
     ```ini
     name = MyMod
     displayName = 我的模组
     version = 1.0.0
     author = YourName

     publishedFileId = 12345    # 已发布的 Workshop 物品 ID（首次上传时为空）
     ```
   - 当创建新的 Workshop 物品时，自动将获取的 `publishedFileId` 写入 `info.ini`
   - 输出日志显示新创建的 `publishedFileId`

## Impact

### 用户影响

- 开发者可以使用统一的 CLI 工具发布到多个平台
- 减少 Steam 发布流程中的手动操作和潜在错误
- 与现有 NuGet 发布工作流保持一致的学习曲线

### 代码影响

- 新增 `src/commands/steam/` 目录，包含 Steam 相关命令实现
- 新增 `src/formats/steam/` 目录，包含 Steam 特定的格式处理逻辑
  - `parser.ts`: 扩展现有 `info.ini` 解析，支持 Steam 字段
  - `metadata.ts`: 处理多语言描述文件，从 `description/*.md` 读取并转换
  - `validator.ts`: Steam Workshop 特定的验证逻辑
  - `workshop.ts`: Steam Workshop 上传封装
  - `progress.ts`: 上传进度跟踪和报告
- 扩展 `src/utils/config.ts` 以支持 Steam 配置
- 新增依赖：`@ducky7go/steamworks.js`

### 配置影响

- 支持新的环境变量：
  - `STEAM_APP_ID`: Steam App ID（游戏ID，用于 Workshop 物品关联，默认 3167020）
- `appId` 是固定值，只能通过环境变量修改，不能在 info.ini 中添加
- `publishedFileId` 作为 `info.ini` 的顶级属性（已存在于现有 ModMetadata 接口中）

## Alternatives Considered

### 1. 使用 SteamCMD 命令行工具

**优点**:
- 官方工具，功能完整
- 无需额外依赖

**缺点**:
- 需要单独安装 SteamCMD
- 跨平台兼容性较差
- 集成复杂度高

### 2. 使用 steamworks.js + 手动 SDK 管理

**优点**:
- 更轻量级
- 无需完整 Steam 安装

**缺点**:
- 需要用户手动下载和配置 Steamworks SDK
- 配置复杂度高

### 3. 使用第三方 Steam 发布服务

**优点**:
- 无需处理 Steam SDK

**缺点**:
- 依赖第三方服务
- 可能产生额外成本
- 功能受限

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| steamworks.js 依赖原生模块，可能在不同平台上遇到编译问题 | 提供清晰的安装文档，说明预编译二进制文件的获取方式 |
| Steam API 频繁更新可能导致不兼容 | 在 proposal 中锁定 steamworks.js 版本范围，并在后续变更中处理 API 更新 |
| 用户 Steam 账号权限不足 | 在验证命令中检查账号权限，提供清晰的错误提示 |
| 上传大文件时的网络稳定性问题 | 实现断点续传或重试机制，提供进度指示 |

## Dependencies

- `@ducky7go/steamworks.js`: 需要确认当前稳定版本和 API 兼容性
- Steamworks SDK: 用户需要拥有 Steamworks SDK 访问权限
- Steam App ID: 固定使用 3167020，可通过环境变量 `STEAM_APP_ID` 覆盖

## Success Criteria

1. 用户可以运行 `ducky steam validate` 验证 Steam 发布配置
2. 用户可以运行 `ducky steam push` 将游戏内容推送到 Steam
3. 命令输出格式与现有 `ducky nuget` 命令保持一致
4. 所有验证失败都有清晰的错误消息和建议
5. 至少包含一个基本的集成测试
6. 新上传时能正确将 `publishedFileId` 写入 `info.ini` 并输出日志

## Out of Scope

- Steam Depot 上传（游戏本体发布）
- DLC 管理功能
- 自动化测试和 CI/CD 集成示例
- Steam P2P 和多人游戏功能
- Steam 输入、云存档等其他 Steamworks 功能
- Workshop 订阅和下载管理

## Related Changes

None - 这是一个全新的功能模块，与现有 NuGet 发布功能并行存在。

## References

- [@ducky7go/steamworks.js GitHub Repository](https://github.com/ceifa/node-steamworks.js)
- [Steamworks Documentation](https://partner.steamgames.com/doc/)
- Existing NuGet specs: `cli-nuget-pack`, `cli-nuget-push`, `cli-nuget-validation`
