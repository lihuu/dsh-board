# dsh-board

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的任务看板插件：**卡片是任务，列是任务状态，每个任务背后挂一个长期存在的原生会话。**


## 为什么

DeepSeek Harness 是"会话中心"的：一个会话一页，没有全局视角——不知道现在有几个在跑、谁卡住了、谁在等你回话。dsh-board 在会话之上加了一层任务：

- **一个工作区一块板**，列是「待办 / 进行中 / 完成」（可改名、可加列）
- 卡片是你写的任务；背后的会话只是执行端
- 卡片上的小徽标才是会话实时状态（运行中 / 等待你确认），列表示的是**任务**状态
- 点卡片，在该板里直接看到那个会话的**真实对话**，不是仿的聊天框


## 功能

- **工作区 = 看板**：顶部标签切换工作区，每块板只显示自己的任务
- **列可配置**：内置三列可改名；列尾可「+ 添加列」；任务可在任意列之间拖拽；自定义列可删除（任务回落到待办）；列配置持久化
- **任务绑定会话**：新建任务时选已有会话或新建会话；默认复用这块板上一次用过的会话，相关任务落在同一个长会话里
- **实时状态**：空闲 / 运行中 / 等待你确认 / 已完成，来自 `ctx.sessions.list` 与 `ctx.uiSession.sessionStatus`，宿主推送更新
- **自动流转**：点「开始」→ 任务进「进行中」；只有这张卡发起的那次运行结束（会话空闲并稳定 2.5s）才标「完成」并记时长；别处发起的运行不动任务状态
- **板内原生对话**：详情栏渲染官方 `conversation.content` Factory，消息流、输入框、模型/权限控件、问题卡片都是真的、可交互
- **任务浮层**：侧栏底部按钮可在任意页面之上打开同一份任务的浮层（徽标 = 进行中数量）
- **键盘**：看板内 ↑↓ 选择、Enter 打开、N 新建、Esc 关闭；对话内 ↑↓ 切上一个/下一个任务，Esc 回看板
- **持久化**：任务、列、选中状态由宿主保存，重启 App 不丢（不只是刷新页面）

## 安装

### 通过插件管理器（推荐）

```sh
dsh plugin add @lihuu/dsh-board
```

或 GUI：**设置 → 插件 → 安装 bundle**，输入 `@lihuu/dsh-board`。
包内含 `cordis.patch.yml` bundle 层，宿主行会自动写入。安装后重启一次 App（宿主半边启动期加载）。

### 开发方式

把仓库挂到 `~/.dsh`（例如用 dsh-plugins 的 install.sh 机制：symlink 到 `~/.dsh/plugins/dsh-board`，
再在 `~/.dsh/cordis.patch.yml` 写入下面这一行）：

```yaml
- insert:
    - id: dsh-board
      name: '@lihuu/dsh-board'
```

## 原生对话是怎么嵌进去的

`conversation.content` 是 `session-maybe` 作用域的官方 Factory，从 root 作用域直接调用会渲染成空白/hero。所以：

1. `main` 面板注册时声明私有子槽 `children: { 'board.detail': { kind: 'single', scope: 'session' } }`，
   渲染器据此把 `SessionProvider` / `renderSlot` 交给面板；
2. 用 `ctx.sessions.retain(id, { source: 'boardPanel' })` 持有 `SessionReference`，外层包 `<SessionProvider>`；
3. 子槽条目调用 `renderFactorySlot('conversation.content', { variant: 'embedded', phase, hero })`。

任务浮层用同样的套路，只是子槽叫 `board.chat`。

## 数据

| 层 | 位置 | 作用 |
| --- | --- | --- |
| 权威 | `~/.dsh/dsh-board/state.json` | 任务、列、视图选择、删除墓碑 |
| 备份 | `~/.dsh/dsh-board/state.json.bak` | 上一次可读版本；主文件损坏时回退 |
| 缓存 | 浏览器 `localStorage` | 同一次运行内缓存；Desktop 每次启动端口随机，不能当跨重启备份 |
| 对话 | DSH 会话存储 | 聊天记录与运行状态；任务只存 `sessionId` |

写入是原子的（tmp + rename）、宿主内串行、按任务 id 合并（`updatedAt` 新者胜）并合并删除墓碑，
所以旧窗口提交旧快照不会抹掉新任务、也不会复活已删任务。客户端每 2.5s 轮询一次，每次防抖写入（400ms）前先合并。

**风险**：单文件 + 一份备份，没有版本历史。请把 `state.json` 纳入你的备份；文件损坏会回退 `.bak`，
但删除 `~/.dsh` 会丢看板（会话本身不受影响）。

## 要求

- DeepSeek Harness ≥ 0.2.2（Web UI 提供 `main`、`sidebar.panellist`、`shell.overlay`、
  `conversation.session.header.utilities` 等 slot）
- 无构建步骤：客户端半边是纯 JS，直接由客户端模块系统加载

## 开发

```
src/index.js     宿主半边：认证 GET/POST /dsh-board/state，原子持久化
lib/client.js    浏览器半边：slot 注册、看板 UI、原生对话嵌入
cordis.patch.yml bundle 行
```

浏览器半边改完刷新页面即可生效；宿主半边改动需要重启 App。

## License

MIT © lihuu
