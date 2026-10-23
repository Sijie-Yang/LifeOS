# LifeOS.app（macOS 外壳）

一个很薄的原生外壳：主窗口是 WKWebView 打开 `http://127.0.0.1:3000`（端口可改，见下方设置），菜单栏有番茄倒计时和「置顶迷你窗」开关。

```bash
macos/build.sh            # 产出 macos/build/LifeOS.app（ad-hoc 签名）
open macos/build/LifeOS.app
```

## 行为

- **服务**：启动时先查 `/api/settings`。已有 LifeOS 就直接用；端口空着就在仓库里后台起 `next dev`（不开 Terminal，输出写到 `~/Library/Logs/LifeOS/server.log`）。之后每 15 秒检查一次，服务挂了（端口空了）会自动重启。**退出 App 不关服务**：ntfy 推送、07:00/20:00 邮件、外部 LLM 都靠它。仓库放在「文稿」等受保护文件夹时，第一次会弹窗询问访问权限，选允许（每次重新构建签名会变，可能再问一次）。
- **登录项**：第一次运行会把自己加进登录项（菜单栏 →「登录时自动打开」可关）。开机自动打开时不弹主窗口，只在菜单栏。仓库文件夹改名或移动后，重新 `macos/build.sh` 再打开一次即可：App 按自己所在位置找仓库，登录项也会自动改登记到新位置。
- 不再需要 `scripts/install-lifeos-dev-agent.sh` / `install-deadline-email-agent.sh` 这类开 Terminal 的 LaunchAgent；截止日期邮件由服务里的 `src/lib/email-schedule.ts` 按服务器本地时间 07:00 / 20:00 发（需配置邮件环境变量）。
- **主窗口**：⌘W / 关闭只是隐藏（番茄钟计时器跑在主窗口页面里），点 Dock 图标或菜单栏「打开 LifeOS」回来。⌘Q 才真正退出。
- **迷你窗**：菜单栏 →「置顶迷你窗」或 ⌘⇧M。浮动 NSPanel，所有桌面 / 全屏应用上都可见，不抢焦点，拖标题栏移动，位置和开关状态会记住。内容是 `/mini` 页面：今天的时间块（高亮进行中和下一个）+ 番茄钟镜像。
- **菜单栏**：番茄进行时显示 `🍅 12:34`（休息 `☕️`，暂停带 `⏸`）。

## 番茄钟状态为什么这样做

计时器状态只存在浏览器 localStorage（`lifeos-pomodoro-timer`），由主窗口的 `PomodoroProvider` 驱动（到点结算、写 `/api/pomodoro`）。如果迷你窗也挂一个 Provider，两边各跑一个计时器，到点会重复结算。所以：

- 两个 WKWebView 用同一个默认 data store，共享 localStorage；
- `/mini` 不跑计时器，只读 localStorage 镜像显示；
- 迷你窗上的按钮把命令写到 `lifeos-pomodoro-command`（storage 事件），同时经原生桥转发给主窗口；主窗口里的 `PomodoroRemoteBridge` 执行，nonce 去重。浏览器里开两个标签页也能用同一套。

已知限制：主窗口隐藏时 WebKit 会节流后台定时器，计时显示不受影响（按 `endsAt` 算），但到点后自动进入休息可能晚几十秒。

## 设置

```bash
defaults write com.lifeos.shell RepoPath /path/to/repo   # 默认：App 所在的仓库
defaults write com.lifeos.shell Port 3001                # 默认取 .env 的 LIFEOS_PORT，没有就 3000；同步修改 LIFEOS_URL
defaults write com.lifeos.shell ServerMode start         # dev（默认）/ start（用 next build 的产物）
```
