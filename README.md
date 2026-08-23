# dsh-user-question-nav

在 DeepSeek Harness 对话中快速定位上一个/下一个用户问题。点击浮动按钮（⏫⏬）自动滚动到对应位置，告别手动滑动查找。

## 解决了什么问题

在长对话中，用户问题（你的提问）散落在大量 AI 回复之间。想回顾「我之前问了什么」只能手动滚动，效率很低。

这个插件在对话区域右侧添加两个浮动按钮：
- **⏫ 上一个问题**：跳转到当前视口上方最近的用户问题
- **⏬ 下一个问题**：跳转到当前视口下方最近的用户问题

目标消息会被滚动到视口中间，方便阅读上下文。

## 前置条件

| 依赖 | 版本要求 | 说明 |
|------|----------|------|
| macOS | — | 当前仅支持 macOS |
| [DeepSeek Harness Desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) | 最新版 | 桌面端客户端，**必须先安装并运行过一次** |
| Node.js | ≥ 18 | 项目编译目标 ES2022 |
| pnpm | 最新版 | 包管理器 |
| git | 最新版 | 用于克隆仓库 |

## 安装

### 第一步：安装 DeepSeek Harness Desktop

如果还没安装 DSH Desktop，先到 [deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) 下载安装并**运行一次**（让它初始化 profile 目录）。

### 第二步：克隆并安装插件

```bash
# 克隆仓库
git clone git@github.com:xiaomujiang/dsh-user-question-nav.git
cd dsh-user-question-nav

# 安装依赖
pnpm install

# 构建
pnpm build
```

### 第三步：安装到 DSH Desktop

双击 `install-user-question-nav.command`，脚本会自动完成构建、复制、挂载。完成后 **Cmd+Q** 退出 DSH Desktop，重新打开。

## 升级

`git pull` 后双击 `install-user-question-nav.command`，脚本会重新构建并覆盖安装。完成后重启 DSH Desktop。

## 效果预览

![效果预览](docs/screenshot.png)

对话区域右侧的 ⏫⏬ 双箭头按钮，点击即可跳转到上一个/下一个用户问题。

## 实现原理

### 挂载策略

`apply()` 中**立即创建按钮 DOM 并挂载到 `document.body`**，不等待对话区域出现。默认定位在视口右侧中间，然后异步查找对话滚动容器 (`[data-conversation-scroll]`)，找到后自动校准位置到对话区右侧边缘。

### 导航逻辑

1. 通过 `[data-chat-flow-kind="user"]` 选择器定位所有用户消息
2. 用**消息中心位置**（而非顶部）判断跳转目标，避免连续点击时选中同一消息
3. `scrollTo({ behavior: 'smooth' })` 平滑滚动到视口中间

### 会话切换

- `MutationObserver` 监听 DOM 变化，检测 scrollport 的 `isConnected` 状态
- 切换会话时旧 scrollport 断开 → 自动回退到默认位置 → 轮询等待新 scrollport 出现 → 重新挂载

### 边界反馈

到达第一个/最后一个问题时，按钮变半透明但仍可点击。点击时弹出气泡提示「已经是第一个问题」/「已经是最后一个问题」，1.5 秒自动消失。

### 图标区分

使用**双箭头**（⏫⏬）而非单箭头，与 DSH 自带的「回到底部」按钮（↓）明确区分。

## 开发

```bash
pnpm install        # 安装依赖
pnpm build          # 构建
pnpm typecheck      # 类型检查
```

## 结构

```
dsh-user-question-nav/
├── dsh.plugin.json        # DSH 插件清单
├── package.json           # npm 包元数据 + dsh.client 配置
├── cordis.patch.yml       # 挂载声明
├── tsconfig.json          # TypeScript 配置
├── tsdown.config.ts       # 构建配置（host + 两个 client bundle）
├── install-user-question-nav.command  # 一键安装脚本
└── src/
    ├── index.ts           # Host 端（空壳）
    ├── invariant.ts       # 不变量
    └── client/
        └── index.ts       # 客户端逻辑（按钮 + 导航）
```

## 参考项目

本插件在以下开源项目的基础上开发：

- [deepseek-harness-desktop](https://github.com/anywhere-labs/deepseek-harness-desktop) — DeepSeek Harness 桌面客户端
- [DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) — DSH 侧边栏插件，本插件的挂载策略参考了该项目

## 许可

MIT