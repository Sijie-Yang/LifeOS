// LifeOS for Windows — thin Electron shell around the local LifeOS Next.js server.
// Mirrors macos/Sources/main.swift:
//
// - Reuses a LifeOS server already on 127.0.0.1:<port> (default 3000), otherwise starts one from the
//   repo with no console window, restarts it if it dies, and leaves it running on quit
//   (ntfy pushes, the 07:00/20:00 emails and external LLMs all need it).
// - Starts at login (tray only, no main window).
// - Main window: the full app. Closing it only hides it, so the PomodoroProvider that owns the
//   running timer stays alive.
// - Tray icon: pomodoro countdown in the tooltip + toggle for an always-on-top mini window that
//   shows /mini. Both windows share the default session (same localStorage), so /mini mirrors the
//   main window's timer and sends commands back to it through the preload bridge.

const { app, BrowserWindow, Menu, Tray, dialog, globalShortcut, ipcMain, nativeImage, screen, shell } =
  require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

if (!app.requestSingleInstanceLock()) app.exit(0);

// MARK: - Settings (userData/shell-settings.json, the counterpart of `defaults write com.lifeos.shell`)

const settingsFile = path.join(app.getPath("userData"), "shell-settings.json");
let settings = {};
try {
  settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
} catch {
  // first run or unreadable file: defaults
}
function setSetting(key, value) {
  if (value === undefined) delete settings[key];
  else settings[key] = value;
  fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

// MARK: - Repo + server

function isRepo(dir) {
  return fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, "prisma"));
}

/** repoPath setting, then the folders above the shell (windows/, windows/dist/, the portable exe). */
function resolveRepoPath() {
  const candidates = [];
  if (settings.repoPath) candidates.push(settings.repoPath);
  const starts = [process.env.PORTABLE_EXECUTABLE_DIR, path.dirname(process.execPath), __dirname];
  for (const start of starts.filter(Boolean)) {
    let dir = start;
    for (let i = 0; i < 5; i++) {
      candidates.push(dir);
      dir = path.dirname(dir);
    }
  }
  return candidates.find(isRepo) ?? null;
}

/** KEY=value lines of the repo's .env (quotes stripped, comments skipped). */
function readEnvFile(repo) {
  const env = {};
  let text = "";
  try {
    text = fs.readFileSync(path.join(repo, ".env"), "utf8");
  } catch {
    return env;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    env[m[1]] = value;
  }
  return env;
}

/** Port: the `port` setting, else LIFEOS_PORT in the repo's .env, else 3000. */
function configuredPort() {
  if (Number.isInteger(settings.port)) return settings.port;
  const repo = resolveRepoPath();
  const n = repo ? Number.parseInt(readEnvFile(repo).LIFEOS_PORT ?? "", 10) : NaN;
  return Number.isInteger(n) ? n : 3000;
}

let port = configuredPort();
let baseURL = `http://127.0.0.1:${port}`;

const logFile = path.join(app.getPath("logs"), "server.log");

const server = {
  process: null,
  startedAt: 0,

  /** Same check as scripts/run-lifeos-dev.sh: only LifeOS /api/settings counts as up.
   *  Resolves "up", "down" (nothing listening: safe to start) or "unhealthy". */
  health() {
    return new Promise((resolve) => {
      const req = http.get(`${baseURL}/api/settings`, { timeout: 5000 }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(res.statusCode === 200 && body.includes("bedtimeTarget") ? "up" : "unhealthy"));
      });
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", (err) => resolve(err.code === "ECONNREFUSED" ? "down" : "unhealthy"));
    });
  },

  /** A server this shell launched less than 3 minutes ago is still booting. */
  get isStarting() {
    return this.process?.exitCode === null && Date.now() - this.startedAt < 180_000;
  },

  /** serverMode: "dev" (default) or "start" (production build). Never stopped by the shell. */
  start(repo) {
    const command = settings.serverMode === "start"
      ? `npm run start -- -p ${port}`
      : `npx next dev --webpack --hostname 127.0.0.1 -p ${port}`;
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const log = fs.openSync(logFile, "a");
    fs.writeSync(log, `[LifeOS shell] ${new Date().toISOString()} ${command} in ${repo}\n`);
    // A shell resolves npm/npx(.cmd) from PATH; detached + windowsHide keeps it alive after quit
    // without a console window.
    const env = { ...process.env, ...readEnvFile(repo) };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(command, {
      cwd: repo,
      env,
      shell: true,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", log, log],
    });
    child.on("error", (err) => fs.appendFileSync(logFile, `[LifeOS shell] ${err.message}\n`));
    child.unref();
    fs.closeSync(log);
    this.process = child;
    this.startedAt = Date.now();
  },

  async waitUntilUp(timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      if ((await this.health()) === "up") return true;
      if (Date.now() > deadline || (this.process && this.process.exitCode !== null)) return false;
      await new Promise((r) => setTimeout(r, 1000));
    }
  },
};

// MARK: - Windows

const preload = path.join(__dirname, "preload.js");
const iconPath = path.join(__dirname, "assets", process.platform === "win32" ? "icon.ico" : "icon.png");

let mainWindow = null;
let miniWindow = null;
let tray = null;
let serverReady = false;
let quitting = false;
let watchdog = null;
let lastHealth = "up";
let miniMode = settings.miniMode ?? "pomodoro";

function webPreferences() {
  // The pomodoro timer runs in the page and must fire on time while the window is hidden.
  return { preload, contextIsolation: true, sandbox: false, backgroundThrottling: false };
}

function isLocal(url) {
  try {
    return ["127.0.0.1", "localhost"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** External links open in the default browser; the app itself stays in the shell. */
function wireLinks(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!isLocal(url) && /^https?:/.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function loadingPage(text) {
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const html = `<html><body style="font:14px 'Segoe UI',system-ui,sans-serif;color:#52525b;display:flex;
    height:100vh;margin:0;align-items:center;justify-content:center;text-align:center;padding:0 40px">
    <p>${safe}</p></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function showLoading(text) {
  mainWindow?.loadURL(loadingPage(text));
}

/** Window bounds saved under `key`, if they still fit on a connected display. */
function savedBounds(key) {
  const b = settings[key];
  if (!b) return null;
  const area = screen.getDisplayMatching(b).workArea;
  const visible = b.x < area.x + area.width && b.x + b.width > area.x && b.y < area.y + area.height && b.y + b.height > area.y;
  return visible ? b : null;
}

function buildMainWindow(show) {
  const bounds = savedBounds("mainBounds");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    ...bounds,
    title: "LifeOS",
    icon: iconPath,
    show,
    autoHideMenuBar: true,
    webPreferences: webPreferences(),
  });
  if (!bounds) mainWindow.center();
  wireLinks(mainWindow);
  // Hide instead of close: the main page's PomodoroProvider owns the timer.
  mainWindow.on("close", (event) => {
    setSetting("mainBounds", mainWindow.getNormalBounds());
    if (!quitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) {
      event.preventDefault();
      reloadAll();
    } else if (input.alt && input.key === "ArrowLeft") {
      mainWindow.webContents.navigationHistory.goBack();
    } else if (input.alt && input.key === "ArrowRight") {
      mainWindow.webContents.navigationHistory.goForward();
    } else if (input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
    }
  });
  showLoading("正在连接 LifeOS…");
}

function showMainWindow() {
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const MINI_DEFAULT_SIZE = { pomodoro: { width: 300, height: 320 }, schedule: { width: 640, height: 640 } };
const MINI_MIN = { width: 240, height: 200 };

function buildMiniWindow() {
  const bounds = savedBounds("miniBounds");
  const size = settings[`miniSize-${miniMode}`] ?? MINI_DEFAULT_SIZE[miniMode] ?? MINI_DEFAULT_SIZE.pomodoro;
  const area = screen.getPrimaryDisplay().workArea;
  miniWindow = new BrowserWindow({
    x: bounds?.x ?? area.x + area.width - size.width - 20,
    y: bounds?.y ?? area.y + 20,
    width: bounds?.width ?? size.width,
    height: bounds?.height ?? size.height,
    minWidth: MINI_MIN.width,
    minHeight: MINI_MIN.height,
    title: "LifeOS",
    icon: iconPath,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    webPreferences: webPreferences(),
  });
  // Above full-screen apps too, like the macOS floating panel.
  miniWindow.setAlwaysOnTop(true, "screen-saver");
  miniWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  wireLinks(miniWindow);
  const saveBounds = () => setSetting("miniBounds", miniWindow.getBounds());
  miniWindow.on("moved", saveBounds);
  // Remember the size per form (pomodoro / schedule) when the user resizes it by hand.
  miniWindow.on("resized", () => {
    const { width, height } = miniWindow.getBounds();
    setSetting(`miniSize-${miniMode}`, { width, height });
    saveBounds();
  });
  miniWindow.on("close", () => {
    if (!quitting) setMini(false);
  });
  miniWindow.on("closed", () => (miniWindow = null));
}

/** /mini switches between a small pomodoro form and a larger schedule form; keep the
 *  top-right corner where it is and restore the size last used for that form. */
function setMiniMode(mode) {
  if (!miniWindow || !(mode in MINI_DEFAULT_SIZE)) return;
  miniMode = mode;
  setSetting("miniMode", mode);
  const size = settings[`miniSize-${mode}`] ?? MINI_DEFAULT_SIZE[mode];
  const old = miniWindow.getBounds();
  const area = screen.getDisplayMatching(old).workArea;
  const width = Math.min(Math.max(size.width, MINI_MIN.width), area.width);
  const height = Math.min(Math.max(size.height, MINI_MIN.height), area.height);
  const x = Math.max(area.x, Math.min(old.x + old.width - width, area.x + area.width - width));
  const y = Math.max(area.y, Math.min(old.y, area.y + area.height - height));
  const frame = { x, y, width, height };
  if (Object.keys(frame).some((k) => frame[k] !== old[k])) miniWindow.setBounds(frame);
}

function setMini(visible) {
  setSetting("miniVisible", visible);
  if (!visible) {
    miniWindow?.hide();
    refreshTrayMenu();
    return;
  }
  if (!miniWindow) buildMiniWindow();
  if (serverReady && !miniWindow.webContents.getURL().startsWith(baseURL)) {
    miniWindow.loadURL(`${baseURL}/mini`);
  }
  miniWindow.showInactive();
  refreshTrayMenu();
}

function toggleMini() {
  setMini(!miniWindow?.isVisible());
}

function reloadAll() {
  if (!serverReady) return;
  mainWindow?.webContents.reload();
  miniWindow?.webContents.reload();
}

// MARK: - Tray + login item

function launchedAtLogin() {
  return process.argv.includes("--hidden") || app.getLoginItemSettings().wasOpenedAtLogin;
}

function loginItemOptions(openAtLogin) {
  // A portable exe runs from a temp copy; register the real file the user double-clicked.
  const exe = process.env.PORTABLE_EXECUTABLE_FILE ?? process.execPath;
  const args = app.isPackaged ? ["--hidden"] : [path.resolve(__dirname), "--hidden"];
  return { openAtLogin, path: exe, args };
}

function isLaunchAtLogin() {
  return app.getLoginItemSettings(loginItemOptions(true)).openAtLogin;
}

function setLaunchAtLogin(on) {
  app.setLoginItemSettings(loginItemOptions(on));
  setSetting("launchAtLogin", on);
  setSetting("loginItemPath", on ? loginItemOptions(on).path : undefined);
  refreshTrayMenu();
}

/** First run: turn the login item on. Later runs: if the shell moved, register this copy. */
function registerLoginItemOnFirstRun() {
  const wanted = settings.launchAtLogin ?? true;
  const exe = loginItemOptions(true).path;
  if (!wanted) return;
  if (settings.loginItemPath && settings.loginItemPath !== exe) {
    app.setLoginItemSettings({ openAtLogin: false, path: settings.loginItemPath, args: ["--hidden"] });
  }
  if (!isLaunchAtLogin() || settings.loginItemPath !== exe) setLaunchAtLogin(true);
}

function refreshTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "打开 LifeOS", click: showMainWindow },
    { label: "置顶迷你窗", type: "checkbox", accelerator: "CommandOrControl+Shift+M",
      checked: Boolean(miniWindow?.isVisible()), click: toggleMini },
    { label: "登录时自动打开", type: "checkbox", checked: isLaunchAtLogin(),
      click: () => setLaunchAtLogin(!isLaunchAtLogin()) },
    { type: "separator" },
    { label: "重新加载", click: reloadAll },
    { label: "打开服务日志", click: () => shell.openPath(logFile) },
    { label: "退出 LifeOS", click: () => app.quit() },
  ]));
}

function buildTray() {
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip("LifeOS");
  tray.on("click", showMainWindow);
  refreshTrayMenu();
}

/** Tooltip shows `🍅 12:34` while a pomodoro runs (☕️ on breaks, ⏸ when paused). */
async function refreshTrayTitle() {
  const source = miniWindow?.webContents.getURL().startsWith(baseURL) ? miniWindow : mainWindow;
  let title = "LifeOS";
  try {
    const raw = await source.webContents.executeJavaScript("localStorage.getItem('lifeos-pomodoro-timer')");
    const s = raw ? JSON.parse(raw) : null;
    if (s && typeof s === "object") {
      const paused = typeof s.pausedAt === "number";
      const ms = paused ? (s.remainingMs ?? 0) : (s.endsAt ?? 0) - Date.now();
      const sec = Math.max(0, Math.ceil(ms / 1000));
      const icon = s.phase === "work" ? "🍅" : "☕️";
      title = `${icon} ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}${paused ? " ⏸" : ""}`;
    }
  } catch {
    // page not loaded yet
  }
  tray?.setToolTip(title);
  if (process.platform === "darwin") tray?.setTitle(title);
}

// MARK: - Pomodoro bridge

// /mini posts its commands here too (window.webkit.messageHandlers.lifeos, see preload.js);
// forward them to the main page, which owns the timer. It also posts `mini-mode`.
ipcMain.on("lifeos:post", (_event, body) => {
  if (body?.kind === "mini-mode" && typeof body.mode === "string") return setMiniMode(body.mode);
  if (body?.kind !== "pomodoro" || !body.command) return;
  const json = JSON.stringify(body.command);
  mainWindow?.webContents.executeJavaScript(
    `window.dispatchEvent(new CustomEvent('lifeos:pomodoro-command', { detail: ${json} }))`);
});

// window.prompt() (Electron has none): a small modal window, answered synchronously.
ipcMain.on("lifeos:prompt", (event, message, defaultText) => {
  const parent = BrowserWindow.fromWebContents(event.sender);
  const win = new BrowserWindow({
    parent, modal: true, width: 380, height: 170, resizable: false, minimizable: false,
    maximizable: false, title: "LifeOS", autoHideMenuBar: true, icon: iconPath,
    webPreferences: { preload, contextIsolation: true, sandbox: false },
  });
  let answered = false;
  const answer = (value) => {
    if (answered) return;
    answered = true;
    event.returnValue = value;
    if (!win.isDestroyed()) win.close();
  };
  const onAnswer = (e, value) => {
    if (e.sender === win.webContents) answer(value);
  };
  ipcMain.on("lifeos:prompt-answer", onAnswer);
  win.on("closed", () => {
    ipcMain.removeListener("lifeos:prompt-answer", onAnswer);
    answer(null);
  });
  win.loadFile(path.join(__dirname, "prompt.html"), { query: { message, value: defaultText ?? "" } });
});

// MARK: - Startup

function startServer() {
  const repo = resolveRepoPath();
  if (!repo) return "找不到 LifeOS 仓库。";
  try {
    server.start(repo);
    return null;
  } catch (err) {
    return `启动服务失败：${err.message}`;
  }
}

/** Ask once for the repo folder when it is not next to the shell. */
async function ensureRepo() {
  if (resolveRepoPath()) return true;
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "选择 LifeOS 仓库文件夹（包含 package.json 和 prisma 的文件夹）",
    properties: ["openDirectory"],
  });
  if (canceled || !filePaths[0] || !isRepo(filePaths[0])) return false;
  setSetting("repoPath", filePaths[0]);
  port = configuredPort();
  baseURL = `http://127.0.0.1:${port}`;
  return true;
}

function startWatchdog() {
  if (watchdog) return;
  watchdog = setInterval(async () => {
    const h = await server.health();
    if (h === "down" && !server.isStarting) startServer();
    if (h === "up" && lastHealth !== "up") {
      if (serverReady) reloadAll();
      else serverDidBecomeReady();
    }
    lastHealth = h;
  }, 15_000);
}

function serverDidBecomeReady() {
  serverReady = true;
  startWatchdog();
  mainWindow.loadURL(baseURL);
  if (settings.miniVisible) setMini(true);
  setInterval(refreshTrayTitle, 1000);
}

app.on("second-instance", () => showMainWindow());
app.on("before-quit", () => (quitting = true));
app.on("window-all-closed", () => {
  // stay in the tray
});
app.on("will-quit", () => globalShortcut.unregisterAll());

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  buildMainWindow(!launchedAtLogin());
  buildTray();
  registerLoginItemOnFirstRun();
  globalShortcut.register("CommandOrControl+Shift+M", toggleMini);

  const h = await server.health();
  if (h === "up") return serverDidBecomeReady();
  if (h === "down") {
    if (!(await ensureRepo())) {
      return showLoading("找不到 LifeOS 仓库。在托盘菜单退出后重新打开，选择包含 package.json 和 prisma 的文件夹。");
    }
    const error = startServer();
    if (error) return showLoading(error);
  }
  showLoading("正在启动 LifeOS 服务…（第一次启动要编译页面，可能需要一两分钟）");
  if (await server.waitUntilUp(180_000)) serverDidBecomeReady();
  else showLoading(`服务没有在 3 分钟内启动。日志：${logFile}`);
  startWatchdog();
});
