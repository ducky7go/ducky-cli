# Steam 创意工坊文档

将模组发布到 Steam 创意工坊的完整指南。

## 前提条件

> **⚠️ 重要**：在使用 Steam 创意工坊功能之前，你必须：
>
> 1. **启动 Steam 客户端**并保持运行状态
> 2. **登录到你的 Steam 账号**
> 3. 确保网络连接正常

如果 Steam 未运行，命令将报错：`Steam is not running`

## 命令

### `ducky steam validate`

验证模组目录是否可用于 Steam 创意工坊发布。

```bash
ducky steam validate <path> [options]
```

**参数：**
- `<path>` - 模组目录路径

**选项：**
- `-v, --verbose` - 启用详细输出

**示例：**
```bash
ducky steam validate ./mods/MyMod
```

### `ducky steam push`

将模组发布到 Steam 创意工坊。

```bash
ducky steam push <path> [options]
```

**参数：**
- `<path>` - 模组目录路径

**选项：**
- `--update-description` - 从 `description/*.md` 文件更新创意工坊描述
- `--changelog <note>` - 为此次更新添加更新日志
- `--skip-tail` - 跳过追加"Submitted via ducky cli"页脚
- `-v, --verbose` - 启用详细输出

**示例：**
```bash
# 首次上传（创建新的创意工坊作品）
ducky steam push ./mods/MyMod

# 更新现有作品（不修改描述）
ducky steam push ./mods/MyMod

# 更新描述和更新日志
ducky steam push ./mods/MyMod --update-description --changelog "修复了一些错误"
```

## 描述更新行为

根据是首次上传还是更新，行为有所不同：

| 场景 | 行为 |
|------|------|
| **首次上传**（info.ini 中没有 `publishedFileId`） | 始终设置主要语言的标题和描述（必需） |
| **使用 `--update-description` 更新** | 更新所有语言的描述（包括主要语言） |
| **不使用 `--update-description` 更新** | 跳过所有描述更新（仅上传内容文件） |

## 配置

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `STEAM_APP_ID` | Steam 创意工坊发布的 App ID | `3167020` |

## 模组目录结构

用于 Steam 创意工坊的有效模组目录应包含：

```
MyMod/
├── info.ini              # 模组元数据（必需）
├── MyMod.dll             # 主 DLL（必需）
├── preview.png           # 预览图片（Steam 必需）
├── description/          # 多语言描述（可选）
│   ├── en.md            # 英文描述
│   ├── zh.md            # 中文描述
│   └── japanese.md      # 日文描述
└── ...其他文件           # 任何其他模组文件
```

### info.ini 格式

```ini
name=MyMod
version=1.0.0
description=我的精彩游戏模组
author=你的名字

# 此字段在首次 Steam 发布后自动添加
publishedFileId=1234567890
```

**Steam 特定字段：**
- `publishedFileId` - Steam 创意工坊已发布文件 ID（首次发布后自动添加）

## 多语言支持

对于 Steam 创意工坊发布，你可以在 `description/` 目录中提供多语言描述：

```
description/
├── en.md          # 英语 (english)
├── zh.md          # 简体中文 (schinese)
├── zh-tw.md       # 繁体中文 (tchinese)
├── japanese.md    # 日语 (japanese)
├── ko.md          # 韩语 (koreana)
└── ...            # 其他支持的语言
```

### 文件名到 Steam 语言代码的映射

| 文件名 | Steam 语言代码 |
|--------|---------------|
| `en.md` | `english` |
| `zh.md`, `zh-cn.md` | `schinese` |
| `zh-tw.md`, `zh-hant.md` | `tchinese` |
| `japanese.md` | `japanese` |
| `ko.md` | `koreana` |
| `de.md` | `german` |
| `fr.md` | `french` |
| `es.md` | `latam` |
| `pt.md`, `pt-br.md` | `brazilian` |
| `ru.md` | `russian` |

### 描述格式

每个 `.md` 文件应包含：

1. **标题**（第一个 H1 标题）：`# 我的作品标题`
2. **描述内容**（Markdown 格式）

Markdown 会自动转换为 Steam 创意工坊的 BBCode 格式。

**示例：`en.md`**
```markdown
# My Awesome Mod

This is a great mod that adds new features to the game.

## Features

- Feature 1
- Feature 2

## Installation

1. Download the mod
2. Extract to game mods folder
3. Enable in game
```

**示例：`zh.md`**
```markdown
# 我的精彩模组

这是一个为游戏添加新功能的精彩模组。

## 功能特性

- 功能 1
- 功能 2

## 安装方法

1. 下载模组
2. 解压到游戏模组文件夹
3. 在游戏中启用
```

## 验证规则

Steam 验证器会检查：

1. **有效的 App ID**：必须配置 Steam App ID
2. **info.ini 存在**：模组元数据所必需
3. **preview.png 存在**：创意工坊预览图片所必需
4. **有效的目录结构**：模组目录必须存在并包含文件

## 示例

### 首次上传

```bash
# 先验证
ducky steam validate ./mods/MyMod

# 发布到 Steam 创意工坊（创建新作品）
ducky steam push ./mods/MyMod
```

成功上传后，`publishedFileId` 会自动添加到 `info.ini`。

### 更新现有创意工坊作品

```bash
# 仅更新内容文件（最快）
ducky steam push ./mods/MyMod

# 更新内容和描述
ducky steam push ./mods/MyMod --update-description

# 更新并添加更新日志
ducky steam push ./mods/MyMod --update-description --changelog "修复关键错误"
```

### 多语言完整工作流程

```bash
# 1. 创建带多语言描述的模组
mkdir -p ./mods/MyMod/description

# 2. 创建描述文件
echo "# My Mod
This is the English description." > ./mods/MyMod/description/en.md

echo "# 我的模组
这是中文描述。" > ./mods/MyMod/description/zh.md

# 3. 添加 preview.png
cp ./preview.png ./mods/MyMod/

# 4. 验证
ducky steam validate ./mods/MyMod

# 5. 首次上传（会上传所有语言）
ducky steam push ./mods/MyMod --update-description

# 6. 后续更新
ducky steam push ./mods/MyMod --update-description --changelog "新功能"
```

## 错误处理

常见错误：

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `Invalid Steam App ID` | `STEAM_APP_ID` 未设置或无效 | 通过环境变量设置正确的 App ID |
| `info.ini not found` | 缺少必需文件 | 创建包含 `name` 和 `version` 的 `info.ini` |
| `preview.png not found` | 缺少必需图片 | 将 `preview.png` 添加到模组目录 |
| `Steam is not running` | Steam 客户端未运行 | 启动 Steam 并登录 |

## 上传过程

上传过程在独立的子进程中运行，以确保 Steamworks 代理进程被正确清理。进度条显示：

- 上传进度百分比
- 已上传字节 / 总字节数
- 上传速度
- 预计剩余时间

示例输出：
```
Uploading content [██████████░░░░] 67.3% | 15.2 MB / 22.6 MB | 2.1 MB/s | ETA: 3s
```

## 系统要求

- Steam 客户端必须运行并已登录
- 配置了有效的 Steam App ID
- 包含有效 `info.ini` 的模组目录
- `preview.png` 图片文件
