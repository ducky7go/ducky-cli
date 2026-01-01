# NuGet 文档

将模组打包并发布到 NuGet 服务器的完整指南。

## 命令

### `ducky nuget pack`

将模组目录打包为 `.nupkg` 文件。

```bash
ducky nuget pack <path> [options]
```

**参数：**
- `<path>` - 模组目录路径

**选项：**
- `-o, --output <path>` - `.nupkg` 文件输出目录（默认：与输入目录相同）
- `-v, --verbose` - 启用详细输出

**示例：**
```bash
ducky nuget pack ./mods/MyMod -o ./output
```

### `ducky nuget push`

将 `.nupkg` 文件发布到 NuGet 服务器。

```bash
ducky nuget push <path> [options]
```

**参数：**
- `<path>` - `.nupkg` 文件路径或模组目录（使用 `--pack` 时）

**选项：**
- `-p, --pack` - 推送前先打包模组
- `-s, --server <url>` - NuGet 服务器 URL（默认：`https://api.nuget.org/v3/index.json`）
- `-k, --api-key <key>` - NuGet API 密钥
- `-o, --output <path>` - `.nupkg` 文件输出目录（使用 `--pack` 时）
- `-v, --verbose` - 启用详细输出

**示例：**
```bash
# 推送已有的 .nupkg 文件
ducky nuget push ./mods/MyMod.1.0.0.nupkg

# 一步完成打包和推送
ducky nuget push ./mods/MyMod --pack

# 使用自定义 NuGet 服务器
ducky nuget push ./mods/MyMod.1.0.0.nupkg --server https://my-nuget-server.com/v3/index.json
```

### `ducky nuget validate`

按照 NuGet 模组打包规范验证模组目录。

```bash
ducky nuget validate <path> [options]
```

**参数：**
- `<path>` - 模组目录路径

**选项：**
- `-v, --verbose` - 启用详细输出

**示例：**
```bash
ducky nuget validate ./mods/MyMod
```

## 配置

配置优先级（从高到低）：
1. 命令行选项
2. 环境变量
3. 默认值

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `NUGET_API_KEY` | NuGet 认证 API 密钥 | - |
| `NUGET_SERVER` | 默认 NuGet 服务器 URL | `https://api.nuget.org/v3/index.json` |
| `NUGET_VERBOSE` | 启用详细输出 | `false` |

## 模组目录结构

一个有效的模组目录应包含：

```
MyMod/
├── info.ini              # 模组元数据（必需）
├── MyMod.dll             # 主 DLL（必需）
└── ...其他文件           # 任何其他模组文件
```

### info.ini 格式

```ini
name=MyMod
version=1.0.0
description=我的精彩游戏模组
author=你的名字
projectUrl=https://github.com/yourname/mymod
license=MIT
tags=game,mod,example

[dependencies]
OtherMod=1.0.0
```

**必需字段：**
- `name` - NuGet 包 ID（必须以字母或下划线开头，最多 100 字符）
- `version` - SemVer 2.0 版本号（如 `1.0.0`、`2.1.0-beta`）

**可选字段：**
- `description` - 包描述
- `author` - 包作者
- `projectUrl` - 项目 URL
- `license` - 许可证标识符
- `tags` - 逗号分隔的标签列表
- `dependencies` - 逗号分隔的依赖列表（可带版本）
- `publishedFileId` - Steam 创意工坊已发布文件 ID（首次 Steam 发布后自动添加）

## 验证规则

工具按照以下规则验证模组：

1. **DLL 名称匹配**：至少有一个 DLL 文件的基础名称与 `info.ini` 中的 `name` 字段匹配
2. **SemVer 2.0 版本**：版本号必须遵循语义化版本 2.0 格式
3. **有效的 NuGet ID**：包名称必须是有效的 NuGet 标识符
4. **必需字段**：`name` 和 `version` 字段为必需

## 示例

### 完整工作流程

```bash
# 1. 创建包含 info.ini 和 DLL 文件的模组目录
mkdir -p ./mods/MyMod

# 2. 验证模组
ducky nuget validate ./mods/MyMod

# 3. 打包模组
ducky nuget pack ./mods/MyMod

# 4. 发布到 NuGet
export NUGET_API_KEY=your-api-key
ducky nuget push ./mods/MyMod.1.0.0.nupkg
```

### 使用自定义 NuGet 服务器

```bash
export NUGET_SERVER=https://my-nuget-server.com/v3/index.json
export NUGET_API_KEY=your-api-key
ducky nuget push ./mods/MyMod.1.0.0.nupkg
```

### 一条命令完成打包和推送

```bash
export NUGET_API_KEY=your-api-key
ducky nuget push ./mods/MyMod --pack
```

## 错误处理

工具提供有用的错误消息和建议：

```
✖ Invalid version format: 1.0

建议:
  • 版本必须遵循 SemVer 2.0 格式
  • 示例: 1.0.0, 2.1.0-beta, 3.0.0-rc.1
```

常见错误：

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `Invalid version format` | 版本不符合 SemVer 2.0 格式 | 使用如 `1.0.0` 或 `2.1.0-beta` 的格式 |
| `No matching DLL found` | 没有与 `name` 字段匹配的 DLL 文件 | 确保 DLL 文件名与 info.ini 中的 `name` 匹配 |
| `Missing required field` | 缺少必需字段 | 确保 `name` 和 `version` 存在 |
