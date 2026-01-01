# ducky-cli

用于将游戏模组打包并发布到 NuGet 服务器和 Steam 创意工坊的命令行工具。

## 安装

```bash
npm install -g ducky-cli
```

或使用 npx：

```bash
npx ducky-cli --help
```

## 快速开始

```bash
# NuGet 打包和发布
ducky nuget pack ./mods/MyMod
ducky nuget push ./mods/MyMod.1.0.0.nupkg

# Steam 创意工坊发布
ducky steam push ./mods/MyMod
ducky steam push ./mods/MyMod --update-description
```

## 文档

- [NuGet 文档](./docs/nuget.md) - 打包和发布到 NuGet 服务器
- [Steam 文档](./docs/steam.md) - 发布到 Steam 创意工坊

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
| `ducky steam validate <path>` | 验证 Steam 创意工坊模组 |
| `ducky steam push <path>` | 发布到 Steam 创意工坊 |

## 配置

通过环境变量设置：

```bash
# NuGet
export NUGET_API_KEY=your-api-key
export NUGET_SERVER=https://api.nuget.org/v3/index.json

# Steam
export STEAM_APP_ID=3167020
```

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
