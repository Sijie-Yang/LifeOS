# LifeOS for Windows（Electron 外壳）

和 `macos/` 的原生外壳做同一件事的 Windows 版：主窗口打开本机的 LifeOS（`http://127.0.0.1:3000`，端口可改），托盘有番茄倒计时和「置顶迷你窗」开关。网页代码和数据库还是仓库里同一套，外壳只负责开窗口、启动服务。每台电脑用自己的 `prisma/dev.db`。

## 安装

需要 Node.js 22.13+（建议 Node 22 LTS）和 Git。先按根目录 [README](../README.md) 的「全新安装」把 LifeOS 装好（PowerShell 里把 `cp` 换成 `copy`）：

```powershell
copy .env.example .env
npm ci
npx prisma generate
npm run db:init
```

然后装外壳并启动：

```powershell
cd windows
npm install
npm start
```

想要一个能双击的程序：`npm run dist` 生成 `windows\dist\LifeOS.exe`（便携版，不用安装）。exe 放在仓库里任意位置都能自动找到仓库；放到别处的话，第一次打开会让你选仓库文件夹。没有代码签名，第一次运行 Windows SmartScreen 可能提示，选「仍要运行」。

## 行为

- **服务**：启动时先查 `/api/settings`。已有 LifeOS 就直接用；端口空着就在仓库里后台起 `next dev`（不弹控制台窗口，输出写到 `%APPDATA%\LifeOS\logs\server.log`，托盘菜单「打开服务日志」）。之后每 15 秒检查一次，服务挂了会自动重启。**退出外壳不关服务**：ntfy 推送、07:00/20:00 邮件、外部 LLM 都靠它。要停掉服务，在任务管理器里结束对应的 `node.exe`。
- **开机自启**：第一次运行会把自己加进开机启动（托盘菜单「登录时自动打开」可关）。开机启动时不弹主窗口，只在托盘。
- **主窗口**：关闭只是隐藏（番茄钟计时器跑在主窗口页面里），点托盘图标回来。托盘菜单「退出 LifeOS」才真正退出。F5 / Ctrl+R 重新加载，Alt+← / Alt+→ 后退前进，F12 开发者工具。
- **迷你窗**：托盘菜单「置顶迷你窗」或全局快捷键 **Ctrl+Shift+M**。永远置顶、不占任务栏、打开时不抢焦点，位置和开关状态会记住。内容是 `/mini`，番茄钟 / 日程两种形态切换时窗口大小跟着变，右上角不动，两种形态各自记住尺寸。
- **托盘**：鼠标悬停显示 `🍅 12:34`（休息 `☕️`，暂停带 `⏸`）。Windows 托盘不能显示文字，所以倒计时在提示里。

番茄钟状态的做法和 macOS 版一样（见 [macos/README.md](../macos/README.md#番茄钟状态为什么这样做)）：两个窗口共用同一个浏览器会话，共享 localStorage；`preload.js` 提供和 WKWebView 相同的 `window.webkit.messageHandlers.lifeos`，所以 `/mini` 不用改就能把命令转给主窗口。Electron 没有 `window.prompt()`，外壳用一个小对话框补上。

## 设置

设置存在 `%APPDATA%\LifeOS\shell-settings.json`（开发模式 `npm start` 时是 `%APPDATA%\lifeos-windows-shell\`），改完重开外壳：

```json
{
  "repoPath": "C:\\Users\\you\\LifeOS",
  "port": 3001,
  "serverMode": "start"
}
```

- `repoPath`：默认是外壳所在的仓库。
- `port`：默认取 `.env` 的 `LIFEOS_PORT`，没有就 3000；同步修改 `LIFEOS_URL`。
- `serverMode`：`dev`（默认）或 `start`（用 `npm run build` 的产物，启动更快）。

外壳也能在 macOS / Linux 上跑（`npm start`），但 macOS 上建议用原生的 `macos/`。
