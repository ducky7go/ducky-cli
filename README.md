# ducky-cli

用于将游戏模组打包并发布到 NuGet 服务器和 Steam 创意工坊的命令行工具。

## 安装

```bash
npm install -g @ducky7go/ducky-cli
```

或使用 npx：

```bash
npx @ducky7go/ducky-cli --help
```

## 快速开始

```bash
# NuGet 打包和发布
ducky nuget pack ./mods/MyMod
ducky nuget push ./mods/MyMod.1.0.0.nupkg

# Steam 创意工坊发布
ducky steam push ./mods/MyMod
ducky steam push ./mods/MyMod --update-description
ducky steam push ./mods/MyMod --visibility friends --tags Weapons,Balance
ducky steam push ./mods/MyMod --dry-run   # 仅预览，不需要 Steam 客户端
```

## 文档

- [NuGet 文档](./docs/nuget.md) - 打包和发布到 NuGet 服务器
- [Steam 文档](./docs/steam.md) - 发布到 Steam 创意工坊（包括 [CI 使用说明](./docs/steam.md#ci-使用说明)、[额外预览图/视频不支持](./docs/steam.md#额外预览图视频不支持) 与 [删除作品](./docs/steam.md#ducky-steam-delete)）

## 功能特性

- **NuGet 打包**：从模组目录创建 `.nupkg` 包
- **NuGet 发布**：发布到 nuget.org 或自定义 NuGet 服务器
- **Steam 创意工坊发布**：支持多语言发布模组
- **验证**：按照打包规范验证模组
- **跨平台**：支持 Windows、macOS 和 Linux

## 命令概览

| 命令 | 描述 |
|------|------|
| `ducky nuget pack <path>` | 将模组目录打包为 `.nupkg` |
| `ducky nuget push <path>` | 发布到 NuGet 服务器 |
| `ducky nuget validate <path>` | 验证 NuGet 模组 |
| `ducky steam validate <path>` | 验证 Steam 创意工坊模组（无需 Steam 客户端） |
| `ducky steam push <path>` | 发布到 Steam 创意工坊，支持 `--visibility`、`--tags`、`--dry-run` |
| `ducky steam list` | 列出你发布的创意工坊作品（`--json`、`--stats`） |
| `ducky steam info <id\|path>` | 查看作品详情（`--json`） |
| `ducky steam subscribed` | 列出已订阅的作品及安装状态（`--json`） |
| `ducky steam link <path> <id>` | 把模组目录关联到已有作品（写入 `publishedFileId`，不连接 Steam） |
| `ducky steam pull <path>` | 拉取作品描述到 `description/<语言>.md`（`--language`、`--force`） |
| `ducky steam delete <id>` | 删除你拥有的作品（需要确认，或 `--yes`） |

Steam 命令的详细说明（App ID 优先级、`.duckyrc`、可见性与标签、CI 使用说明）见 [Steam 文档](./docs/steam.md)。

## 配置

通过环境变量设置：

```bash
# NuGet
export NUGET_API_KEY=your-api-key
export NUGET_SERVER=https://api.nuget.org/v3/index.json

# Steam
export STEAM_APP_ID=3167020
```

Steam 的默认值也可以写在 `.duckyrc`（JSON，从当前目录向上查找，其次是用户主目录）：

```json
{
  "steam": {
    "appId": 3167020,
    "visibility": "friends",
    "tags": ["Weapons", "Balance"]
  }
}
```

App ID 的优先级为 `--app-id` > `STEAM_APP_ID` > `.duckyrc` > 默认值 `3167020`。详见 [Steam 文档](./docs/steam.md#app-id-优先级)。

## 模组目录结构

```
MyMod/
├── info.ini              # 模组元数据（必需）
├── MyMod.dll             # 主 DLL（必需）
├── preview.png           # 预览图片（Steam 必需）
├── description/          # 多语言描述（Steam 使用）
│   ├── en.md
│   └── zh.md
└── ...其他文件
```

## 许可证

MIT License - 详见 LICENSE 文件

## 相关项目

- [action-ducky-nuget](https://github.com/ducky7go/action-ducky-nuget) - CI/CD GitHub Action
- [NuGet 模组打包规范](https://github.com/ducky7go/dukcy-package-spec)

## 支持

- 报告问题：[GitHub Issues](https://github.com/ducky7go/ducky-cli/issues)
