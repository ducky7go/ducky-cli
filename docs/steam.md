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

验证模组目录是否可用于 Steam 创意工坊发布。该命令只使用本地文件和配置，不需要 Steam 客户端，可在 CI 中运行。

```bash
ducky steam validate <path> [options]
```

**参数：**
- `<path>` - 模组目录路径

**选项：**
- `--app-id <id>` - 指定 Steam App ID，覆盖 `STEAM_APP_ID` 和 `.duckyrc`
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
- `--visibility <name>` - 可见性：`public`、`friends`、`private`、`unlisted`（优先级见下文"可见性与标签"）
- `--tags <a,b,...>` - 逗号分隔的创意工坊标签（优先级见下文"可见性与标签"）
- `--dry-run` - 仅预览将要发送的内容：不连接 Steam、不创建或修改作品、不修改任何文件
- `--app-id <id>` - 指定 Steam App ID，覆盖 `STEAM_APP_ID` 和 `.duckyrc`
- `-v, --verbose` - 启用详细输出

**示例：**
```bash
# 首次上传（创建新的创意工坊作品）
ducky steam push ./mods/MyMod

# 更新现有作品（不修改描述）
ducky steam push ./mods/MyMod

# 更新描述和更新日志
ducky steam push ./mods/MyMod --update-description --changelog "修复了一些错误"

# 设置可见性和标签
ducky steam push ./mods/MyMod --visibility friends --tags Weapons,Balance

# 先预览（不需要 Steam 客户端，可在 CI 中运行）
ducky steam push ./mods/MyMod --dry-run --visibility friends --tags a,b --changelog "修复"
```

### 预览（`--dry-run`）

`--dry-run` 使用与真实上传相同的计划，输出内容包括：

- 将创建新作品，还是更新哪个 `publishedFileId`
- App ID
- 将上传的全部文件及大小（整个模组目录）
- 预览图 `preview.png`
- 标题、将发送的描述语言及大小
- 可见性、标签和更新日志

预览前会运行与 `ducky steam validate` 相同的校验，校验失败时以退出码 1 结束。预览不会与 Steam 上的当前值做比较，只说明将要发送的内容。

## 可见性与标签

**可见性**优先级：`--visibility` > `.duckyrc` 的 `steam.visibility` > 默认 `public`。

**标签**优先级：`--tags` > `info.ini` 的 `tags` 字段 > `.duckyrc` 的 `steam.tags`。高优先级的值整体替换低优先级的值，不会合并。标签会去除首尾空白、丢弃空项并去重。

**默认行为保持不变（重要）**：未配置任何可见性时，每次更新都会把作品的可见性设为公开（这是既有行为，为兼容保留）。因此，如果作品原本是私有的，未指定可见性再次发布会将其改为公开。要避免这一点，请在 `.duckyrc` 中设置 `steam.visibility`，或每次发布时传入 `--visibility`。未配置标签时，不会发送标签字段，远程已有的标签保持不变。

## 批量发布

`ducky steam push` 可以一次接受多个模组目录，按给出的顺序依次发布：

```bash
ducky steam push ./mods/A ./mods/B ./mods/C --visibility private --changelog "修复"
```

- 每个目录独立处理：某个目录失败（例如校验失败，或不是目录），其余目录仍会继续发布。
- 结束时打印汇总：成功数、需要处理数和失败数，并逐个列出目录。
- 只要有一个目录失败，退出码为 1；全部成功则为 0。
- 需要接受创意工坊协议的目录会标为"需要处理"，但不算失败，退出码仍为 0。
- 共享选项（`--visibility`、`--tags`、`--changelog`、`--dry-run` 等）应用于每个目录。
- 通配符（如 `./mods/*`）由 shell 展开，CLI 本身不做通配符展开。

Windows PowerShell 不会展开 `*`，请逐个写出路径，或用 PowerShell 展开目录列表：

```powershell
# 逐个写出路径
ducky steam push .\mods\A .\mods\B

# 展开 mods 下的所有子目录
ducky steam push (Get-ChildItem .\mods -Directory | ForEach-Object { $_.FullName })
```

### `ducky steam list`

列出当前登录 Steam 账号在所选 App ID 下发布的全部创意工坊作品（自动翻页）。需要本地运行并登录的 Steam 客户端。

```bash
ducky steam list [options]
```

**选项：**
- `--json` - 以 JSON 输出到标准输出，日志改为输出到标准错误
- `--stats` - 表格中额外显示收藏、关注者、评论和投票数
- `--app-id <id>` - 指定 App ID
- `-v, --verbose` - 启用详细输出

**示例：**
```bash
ducky steam list
```
```
ID          Title         Visibility  Updated               Subscribers
----------  ------------  ----------  --------------------  -----------
1234567890  My Awesome    friends     2024-05-01T10:00:00Z  42
```

```bash
ducky steam list --json > items.json
```

**JSON 字段**（`items` 数组中每一项）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | 字符串 | 作品 ID（字符串，避免大整数精度丢失） |
| `title` | 字符串 | 标题 |
| `visibility` | 字符串 | `public`、`friends`、`private` 或 `unlisted` |
| `timeUpdated` | 字符串 | ISO-8601 更新时间 |
| `subscribers` | 数字 | 订阅数 |
| `favorites` | 数字 | 收藏数 |
| `followers` | 数字 | 关注者数 |
| `comments` | 数字 | 评论数 |
| `upvotes` / `downvotes` | 数字 | 赞成 / 反对票数 |
| `tags` | 字符串数组 | 标签 |
| `url` | 字符串 | 创意工坊页面地址 |

顶层对象为 `{ "appId": <数字>, "items": [...] }`。没有作品时 `items` 为空数组。

### `ducky steam info`

显示一个创意工坊作品的详情。参数可以是作品 ID，也可以是模组目录（读取其 `info.ini` 中的 `publishedFileId`）。若参数是已存在的目录，则优先按目录处理，即使目录名是数字。

```bash
ducky steam info <id|path> [options]
```

**选项：**
- `--json` - 以 JSON 输出完整信息（包括完整描述），日志输出到标准错误
- `--app-id <id>` - 指定 App ID
- `-v, --verbose` - 启用详细输出

**示例：**
```bash
ducky steam info 1234567890
ducky steam info ./mods/MyMod
ducky steam info 1234567890 --json
```

人类可读视图显示标题、ID、可见性、标签、所有者、创建与更新时间、订阅/收藏/关注/评论数、投票、页面地址以及描述摘要（前 500 个字符）。`--json` 的字段与 `list` 的字段相同，并额外包含完整的 `description`。

常见错误：
- 目录的 `info.ini` 没有 `publishedFileId`：使用 `ducky steam push` 发布，或用 `ducky steam link` 关联已有作品。
- 作品不存在：检查 ID 与 App ID。
- 参数既不是目录也不是数字 ID：会以退出码 1 失败。

### `ducky steam subscribed`

列出当前账号订阅的作品，并显示本地安装状态。

```bash
ducky steam subscribed [options]
```

**选项：**
- `--json` - 以 JSON 输出，日志输出到标准错误
- `--app-id <id>` - 指定 App ID
- `-v, --verbose` - 启用详细输出

**JSON 字段**（`items` 数组中每一项）：`id`（字符串）、`title`、`installed`（布尔值），以及已安装时的 `folder`、`sizeOnDisk`（字节数）和 `installedAt`（ISO-8601 时间）。顶层对象为 `{ "appId": <数字>, "items": [...] }`。

### `ducky steam link`

把本地模组目录关联到一个已经存在的创意工坊作品，即把作品 ID 写入 `info.ini` 的 `publishedFileId`。这个命令不连接 Steam。之后执行 `ducky steam push` 会更新该作品，而不会创建新作品。用它可以避免重复创建作品。

```bash
ducky steam link <path> <id> [options]
```

**选项：**
- `--force` - 替换 `info.ini` 中已有的、不同的 `publishedFileId`
- `-v, --verbose` - 启用详细输出

**行为：**
- `info.ini` 中已经是同一个 ID：不做任何修改。
- `info.ini` 中已有不同的 ID：默认拒绝（退出码 1），并提示使用 `--force`。
- ID 必须是正整数，否则以退出码 1 失败。
- 没有 `info.ini`：以退出码 1 失败，提示与 `validate` 相同。
- 除 `publishedFileId` 行之外，`info.ini` 的其他内容保持不变。

**示例：**
```bash
ducky steam link ./mods/MyMod 1234567890
ducky steam push ./mods/MyMod --update-description   # 更新 1234567890，不创建新作品
```

### `ducky steam pull`

从创意工坊拉取作品的长描述，写入模组目录的 `description/<语言>.md`。需要 `info.ini` 中已有 `publishedFileId`（可用 `link` 设置）。

```bash
ducky steam pull <path> [--language <code>]... [options]
```

**选项：**
- `--language <code>` - 要拉取的语言，可重复。默认 `en`。
- `--force` - 覆盖已存在的描述文件（默认不覆盖）
- `--app-id <id>` - 指定 App ID
- `-v, --verbose` - 启用详细输出

**示例：**
```bash
# 拉取英文，写入 description/en.md
ducky steam pull ./mods/MyMod

# 拉取简体中文和日文，写入 description/zh.md 与 description/japanese.md
ducky steam pull ./mods/MyMod --language schinese --language japanese
```

**文件名与语言的对应关系**（`pull` 与 `push` 使用相同的映射）：

| Steam 语言 | 文件名 | 也可以写作 `--language` |
|------------|--------|--------------------------|
| `english` | `en.md` | `en`、`english` |
| `schinese` | `zh.md` | `zh`、`zh-cn`、`schinese` |
| `tchinese` | `zh-tw.md` | `zh-tw`、`zh-hant`、`tchinese` |
| 其他语言 | `<Steam 代码>.md`，例如 `japanese.md`、`koreana.md` | `ja`、`japanese`，等 |

**文件内容：** `# <作品标题>` 后接转换为 Markdown 的描述。如果描述已经以相同的一级标题开头，则不会重复标题。`push` 追加的页脚（`[hr]Submmited via ducky cli`）会被移除。

**覆盖保护：** 已存在的文件默认不会被覆盖。该文件记为失败（退出码 1），其余语言照常处理。加上 `--force` 才会覆盖。

**没有对应译文：** Steam 在没有某种语言的译文时会返回默认语言的内容。`pull` 会与英文内容比较，若标题和描述完全相同，则跳过该语言并给出警告，不写入文件；这不算失败。

**不支持的语言：** 在写入任何文件之前失败（退出码 1），并列出支持的取值。

**BBCode 往返的已知损失：**
- 行内代码在 `push` 时会变成粗体（`[b]`），因此拉取后显示为粗体。
- 有序列表拉取后变为无序列表。
- 图片的替代文字不保存在 BBCode 中，拉取后为空。
- 不支持的标签（例如颜色、下划线）会被移除，只保留文字；使用 `--verbose` 可以看到被移除的标签名。

在支持的构造（标题、粗体、斜体、删除线、列表、链接、图片、引用、代码块、分隔线）上，`push` 之后再 `pull`，再 `push`，得到的 BBCode 保持不变。

### `ducky steam delete`

永久删除你拥有的创意工坊作品。删除不可撤销，因此必须明确确认。

```bash
ducky steam delete <id> [--yes] [options]
```

**选项：**
- `--yes` - 不提示，直接删除
- `--app-id <id>` - 指定 App ID
- `-v, --verbose` - 启用详细输出

**确认规则：**
- 在交互式终端中不加 `--yes` 运行时，会显示作品标题并要求输入完全相同的作品 ID；输入其他内容则取消，退出码为 1，什么都不会删除。
- 在非交互环境（管道、CI）中不加 `--yes` 运行时，直接以退出码 1 失败，不会提示，也不会删除。
- 删除不修改任何本地文件。成功后会提醒你从本地 `info.ini` 中删除对应的 `publishedFileId`。

**示例：**
```bash
ducky steam delete 1234567890
ducky steam delete 1234567890 --yes
```

Steam 拒绝删除（作品不存在，或不属于当前账号）时，会显示 Steam 给出的原因和检查建议，退出码为 1。

**删除结果与退出码：**

删除在独立的子进程中执行，因此即使 Steam 原生库异常终止，命令仍能给出结果。结果分为三种：

| 结果 | 含义 | 退出码 |
|------|------|--------|
| 已删除 | Steam 接受了删除；或 Steam 库异常结束后，再次查询确认作品已不存在 | 0 |
| 未删除 | Steam 拒绝删除；或删除请求尚未发出（子进程无法启动、Steam 未运行）；或异常结束后确认作品仍存在 | 1 |
| 不确定 | Steam 库异常结束，且无法确认作品是否仍存在（例如 Steam 无法连接） | 2 |

只有"已删除"会输出 `Deleted Workshop item <id>`。"不确定"时不会输出成功信息，命令会给出核实步骤。

**为什么会出现"不确定"：** Steam 原生库偶尔会在删除过程中异常终止（abort 或信号）。此时命令收不到 Steam 的回复，作品可能已经被删除，也可能没有。导致异常终止的 Steam 结果码尚未经复现确认，因此本文档不指定具体的结果码；在确认之前，原因视为未确认。

**如何核实并决定是否重试：**

1. 运行 `ducky steam info <id>`。若作品已不存在，会提示 `Workshop item <id> was not found`。
2. 或运行 `ducky steam list`，确认该 ID 不在列表中。
3. 只有作品仍然存在时才重试 `ducky steam delete <id>`。作品已不存在时重试没有意义。

若 Steam 库异常结束但之后核实确认作品已删除，命令仍以退出码 0 结束；输出会说明 Steam 库结束的方式（信号或退出码），并说明删除已在之后经核实确认。

## 描述更新行为

根据是首次上传还是更新，行为有所不同：

| 场景 | 行为 |
|------|------|
| **首次上传**（info.ini 中没有 `publishedFileId`） | 始终设置主要语言的标题和描述（必需） |
| **使用 `--update-description` 更新** | 更新所有语言的描述（包括主要语言） |
| **不使用 `--update-description` 更新** | 跳过所有描述更新（仅上传内容文件） |

## 配置

### App ID 优先级

每个需要 App ID 的 `ducky steam` 命令，按以下顺序取第一个可用的值：

1. `--app-id <id>` 命令行选项
2. `STEAM_APP_ID` 环境变量
3. `.duckyrc` 中的 `steam.appId`
4. 默认值 `3167020`

非正整数的值会被拒绝，错误信息会指出来源（例如 `--app-id` 选项或 `.duckyrc`）。

### 环境变量

| 变量 | 描述 | 默认值 |
|------|------|--------|
| `STEAM_APP_ID` | Steam 创意工坊发布的 App ID | `3167020` |

### .duckyrc

`.duckyrc` 是一个 JSON 文件，用于保存 Steam 的默认设置。查找规则：从当前工作目录开始向上逐级查找，使用找到的第一个文件；若都没有，则使用用户主目录下的 `.duckyrc`。找到的文件整体生效，不会与其他位置的文件合并。文件不存在不是错误。

```json
{
  "steam": {
    "appId": 3167020,
    "visibility": "friends",
    "tags": ["Weapons", "Balance"]
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `steam.appId` | 正整数 | App ID，优先级低于 `--app-id` 和 `STEAM_APP_ID` |
| `steam.visibility` | `public` / `friends` / `private` / `unlisted` | `push` 的默认可见性，优先级低于 `--visibility` |
| `steam.tags` | 字符串数组 | `push` 的默认标签，优先级低于 `--tags` 和 `info.ini` 的 `tags` |

规则：

- 文件中 `steam` 之外的键会被忽略。
- JSON 格式错误、`visibility` 不在允许的四个值之中、`tags` 不是数组、`appId` 不是正整数时，命令以退出码 1 失败，并指出文件路径和出错的键。
- 高优先级来源提供的值会整体替换低优先级的值，不会合并。

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
- `tags` - 创意工坊标签，逗号分隔（例如 `tags = Weapons, Balance`）；优先级低于 `--tags`，高于 `.duckyrc` 的 `steam.tags`

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
| `The Steamworks library failed to load` | 原生库无法在当前平台加载 | 查看提示中的原因；确认平台受支持并重新执行 `pnpm install` |
| `needs the Workshop agreement` 警告 | 创意工坊协议尚未接受 | 见下文"需要接受创意工坊协议" |
| `Steam 库意外结束`（abort 或信号） | 原生库在命令执行中被终止，命令无法从 Steam 得到回复 | 用 `ducky steam info <id>` 或 `ducky steam list` 核实作品状态后再重试；删除命令见上文"删除结果与退出码" |
| `The publish outcome is unverified` | 上传子进程被信号终止 | 先在创意工坊或 `ducky steam info <id>` 中确认作品，确认后再重试，避免重复创建 |

### Steam 未运行或未登录

错误信息为 `Steam is not running or you are not logged in`，退出码为 1。请按以下步骤检查：

1. 启动 Steam 客户端并登录。
2. 确认 Steam 与终端以同一用户、同一权限级别运行。
3. 重新执行命令。

在发布前检测到这一点，因此不会创建新作品，`info.ini` 也不会被修改。

### 需要接受创意工坊协议

首次发布时，如果 Steam 返回 `needsToAcceptAgreement`，工具会：

- 仍然把新的 `publishedFileId` 写入 `info.ini`（作品已经存在，不会因重试而重复创建）；
- 打印醒目的警告：作品在协议接受之前保持隐藏；
- 提示在 <https://steamcommunity.com/sharedfiles/workshoplegalagreement> 以同一账号登录后接受协议，然后再次执行 `ducky steam push`。

多目录发布时，此类目录会在汇总中标为"需要处理"。
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

## 开发说明

### 依赖验证

依据 `@hagicode/steamworks.js@0.1.6-dev.17` 的 `client.d.ts` 声明核对。运行时列沿用 `@ducky7go/steamworks.js@0.1.3` 时的核对结果；新版本的运行时需要 Steam 客户端，尚未复核：

| API | 声明 | 运行时 | 结果 |
|-----|------|--------|------|
| `workshop.getUserItems` | 有 | 有（0.1.3，未复核） | 存在 |
| `workshop.getItem` | 有 | 有（0.1.3，未复核） | 存在 |
| `workshop.getItems` | 有 | 有（0.1.3，未复核） | 存在 |
| `workshop.deleteItem` | 有 | 有（0.1.3，未复核） | 存在 |
| `workshop.getSubscribedItems` | 有 | 有（0.1.3，未复核） | 存在 |
| `workshop.installInfo` | 有 | 有（0.1.3，未复核） | 存在 |
| `localplayer.getSteamId`（含 `accountId`） | 有 | 有（0.1.3，未复核） | 存在 |
| `isConnected` | 有 | 有（顶层导出） | 存在 |
| `UgcUpdate.tags` / `UgcUpdate.visibility` | 有 | — | 存在 |
| `WorkshopItem.statistics` | 有 | — | 存在 |
| `WorkshopItemQueryConfig.includeLongDescription` / `language` | 有 | — | 存在 |
| 通过 `UgcUpdate` 写入附加预览（`additionalPreviewPaths`） | 有 | — | 存在，CLI 未使用 |

结论：所需 API 在声明中全部存在。`UgcUpdate` 现在有 `additionalPreviewPaths` 字段，但 CLI 尚未实现该写入路径，仍只使用 `preview.png`；额外预览图的上传需要单独立项。

注意：`init()` 在 `client.d.ts` 中声明返回 `void`，但顶层 `index.d.ts` 声明返回客户端对象；实现时以顶层入口为准。

## CI 使用说明

- **发布需要本地运行并登录的 Steam 客户端。** 本工具不支持无界面（headless）的创意工坊发布。
- **在 CI 中可用的检查：**
  - `ducky steam validate <path>`：只使用本地文件，不加载 Steamworks，不需要 Steam。通过退出码 0，失败退出码 1。
  - `ducky steam push <path> --dry-run`：只做预览，不连接 Steam，不创建或修改作品，不修改文件。
- **有 Steam 客户端的自托管 runner 可以执行 `push`。** 设置 `CI=true` 不会阻止命令运行；只有在无法连接 Steam 而失败时，错误信息中才会附加上述 CI 提示。
- **与 `ducky7go/action-ducky-nuget` 的关系：** 该 GitHub Action 只封装 `ducky nuget push`，用于发布 NuGet 包，不发布到 Steam 创意工坊。本次变更不修改该 action。

## 额外预览图/视频不支持

创意工坊作品只使用模组目录中的 `preview.png` 作为预览图。`previews/` 等目录中的额外图片或视频**不会**被上传，CLI 也不会读取该目录。

原因：CLI 尚未调用 `UgcUpdate.additionalPreviewPaths`（`@hagicode/steamworks.js@0.1.6-dev.17` 已声明该字段）；`additionalPreviews` 在读取作品信息时返回（见上文"依赖验证"）。
