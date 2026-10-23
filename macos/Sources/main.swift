// LifeOS.app — thin macOS shell around the local LifeOS Next.js server.
//
// - Reuses a LifeOS server already on 127.0.0.1:<Port> (default 3000), otherwise starts one from the
//   repo with no Terminal window, restarts it if it dies, and leaves it running on quit
//   (ntfy pushes, the 07:00/20:00 emails and external LLMs all need it).
// - Login item; when launched at login it stays hidden in the menu bar.
// - Main window: WKWebView on the full app. Closing it only hides it, so the
//   PomodoroProvider that owns the running timer stays alive.
// - Menu bar item: pomodoro countdown + toggle for an always-on-top mini panel that
//   shows /mini. Both web views share the default data store (same localStorage),
//   so /mini mirrors the main window's timer and sends commands back to it.

import AppKit
import ServiceManagement
import WebKit

let defaults = UserDefaults.standard

// MARK: - Repo + server

func resolveRepoPath() -> String? {
    let fm = FileManager.default
    func isRepo(_ path: String) -> Bool {
        fm.fileExists(atPath: (path as NSString).appendingPathComponent("package.json"))
            && fm.fileExists(atPath: (path as NSString).appendingPathComponent("prisma"))
    }
    var candidates: [String] = []
    if let p = defaults.string(forKey: "RepoPath") { candidates.append((p as NSString).expandingTildeInPath) }
    // The repo the app lives in (…/macos/build/LifeOS.app) comes before the path baked in
    // at build time, so renaming or moving the repo folder keeps working.
    var dir = Bundle.main.bundleURL.deletingLastPathComponent()
    for _ in 0..<5 {
        candidates.append(dir.path)
        dir = dir.deletingLastPathComponent()
    }
    if let p = Bundle.main.object(forInfoDictionaryKey: "LifeOSRepoPath") as? String { candidates.append(p) }
    return candidates.first(where: isRepo)
}

/// Port: the `Port` user default, else LIFEOS_PORT in the repo's .env, else 3000.
func configuredPort() -> Int {
    if let p = defaults.object(forKey: "Port") as? Int { return p }
    if let repo = resolveRepoPath(),
       let env = try? String(contentsOfFile: repo + "/.env", encoding: .utf8) {
        for line in env.split(whereSeparator: \.isNewline) {
            let t = line.trimmingCharacters(in: .whitespaces)
            guard t.hasPrefix("LIFEOS_PORT=") else { continue }
            let value = t.dropFirst("LIFEOS_PORT=".count).trimmingCharacters(in: CharacterSet(charactersIn: "\"' "))
            if let n = Int(value) { return n }
        }
    }
    return 3000
}

let port = configuredPort()
let baseURL = URL(string: "http://127.0.0.1:\(port)")!

enum ServerHealth {
    case up
    /// Nothing listening on the port: safe to start a server.
    case down
    /// Something answers but it is not a healthy LifeOS (500, timeout while compiling…).
    case unhealthy
}

final class ServerController {
    private(set) var process: Process?
    private var startedAt: Date?
    var logURL: URL {
        let dir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/LifeOS")
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("server.log")
    }

    /// Same check as scripts/run-lifeos-dev.sh: only LifeOS /api/settings counts as up.
    func health(_ done: @escaping (ServerHealth) -> Void) {
        var req = URLRequest(url: baseURL.appendingPathComponent("api/settings"))
        req.timeoutInterval = 5
        URLSession.shared.dataTask(with: req) { data, resp, error in
            let result: ServerHealth
            if (resp as? HTTPURLResponse)?.statusCode == 200,
               data.map({ String(decoding: $0, as: UTF8.self).contains("bedtimeTarget") }) == true {
                result = .up
            } else if (error as? URLError)?.code == .cannotConnectToHost {
                result = .down
            } else {
                result = .unhealthy
            }
            DispatchQueue.main.async { done(result) }
        }.resume()
    }

    /// A server this app launched less than 3 minutes ago is still booting.
    var isStarting: Bool {
        guard let startedAt, process?.isRunning == true else { return false }
        return Date().timeIntervalSince(startedAt) < 180
    }

    /// ServerMode: "dev" (default, same as the old LaunchAgent) or "start" (production build).
    /// The server is never stopped by the app, so it outlives ⌘Q.
    func start(repo: String) throws {
        let command = defaults.string(forKey: "ServerMode") == "start"
            ? "exec npm run start -- -p \(port)"
            : "exec npx next dev --webpack --hostname 127.0.0.1 -p \(port)"

        if !FileManager.default.fileExists(atPath: logURL.path) {
            FileManager.default.createFile(atPath: logURL.path, contents: nil)
        }
        let log = try FileHandle(forWritingTo: logURL)
        log.seekToEndOfFile()
        log.write("[LifeOS.app] \(Date()) \(command) in \(repo)\n".data(using: .utf8)!)

        let p = Process()
        // Login shell so Homebrew / nvm node is on PATH; .env exported like start-dev.command.
        p.executableURL = URL(fileURLWithPath: "/bin/zsh")
        p.arguments = ["-lc", """
            export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
            if [[ -f .env ]]; then set -a; source .env; set +a; fi
            \(command)
            """]
        p.currentDirectoryURL = URL(fileURLWithPath: repo)
        p.standardInput = FileHandle.nullDevice
        p.standardOutput = log
        p.standardError = log
        try p.run()
        process = p
        startedAt = Date()
    }

    func waitUntilUp(timeout: TimeInterval, _ done: @escaping (Bool) -> Void) {
        let deadline = Date().addingTimeInterval(timeout)
        func poll() {
            health { h in
                if h == .up { return done(true) }
                if Date() > deadline || self.process?.isRunning == false { return done(false) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: poll)
            }
        }
        poll()
    }
}

// MARK: - Web views

/// Every web view uses the default data store, so localStorage is shared.
func sharedWebConfig() -> WKWebViewConfiguration {
    let c = WKWebViewConfiguration()
    c.websiteDataStore = .default()
    c.preferences.setValue(true, forKey: "developerExtrasEnabled")
    // The pomodoro timer runs in the page and must fire on time while the window is
    // hidden or covered, so turn off WebKit's hidden-page timer throttling and process
    // suppression (private preferences; skipped if this WebKit lacks them).
    for key in ["hiddenPageDOMTimerThrottlingEnabled", "hiddenPageDOMTimerThrottlingAutoIncreases",
                "pageVisibilityBasedProcessSuppressionEnabled"]
    where c.preferences.responds(to: Selector("_set\(key.prefix(1).uppercased() + key.dropFirst()):")) {
        c.preferences.setValue(false, forKey: key)
    }
    return c
}

final class WebUIDelegate: NSObject, WKUIDelegate, WKNavigationDelegate {
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, let host = url.host,
           !["127.0.0.1", "localhost"].contains(host), navigationAction.navigationType == .linkActivated {
            NSWorkspace.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert()
        a.messageText = message
        a.runModal()
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert()
        a.messageText = message
        a.addButton(withTitle: "确定")
        a.addButton(withTitle: "取消")
        completionHandler(a.runModal() == .alertFirstButtonReturn)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (String?) -> Void) {
        let a = NSAlert()
        a.messageText = prompt
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
        field.stringValue = defaultText ?? ""
        a.accessoryView = field
        a.addButton(withTitle: "确定")
        a.addButton(withTitle: "取消")
        completionHandler(a.runModal() == .alertFirstButtonReturn ? field.stringValue : nil)
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.canChooseDirectories = parameters.allowsDirectories
        panel.begin { completionHandler($0 == .OK ? panel.urls : nil) }
    }
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKScriptMessageHandler {
    let server = ServerController()
    let uiDelegate = WebUIDelegate()
    var mainWindow: NSWindow!
    var mainWebView: WKWebView!
    var miniPanel: NSPanel?
    var miniWebView: WKWebView?
    var statusItem: NSStatusItem!
    var miniMenuItem: NSMenuItem!
    var statusTimer: Timer?
    var serverReady = false
    var terminating = false
    var watchdog: Timer?
    var lastHealth: ServerHealth = .up
    var loginMenuItem: NSMenuItem!
    /// Keeps App Nap from throttling the app while it sits hidden in the menu bar.
    let activity = ProcessInfo.processInfo.beginActivity(
        options: .userInitiatedAllowingIdleSystemSleep, reason: "LifeOS pomodoro timer")

    func applicationDidFinishLaunching(_ notification: Notification) {
        let atLogin = launchedAsLoginItem()
        buildMainMenu()
        buildMainWindow(show: !atLogin)
        buildStatusItem()
        registerLoginItemOnFirstRun()
        showLoading("正在连接 LifeOS…")

        server.health { h in
            if h == .up { return self.serverDidBecomeReady() }
            if h == .down, let error = self.startServer() { return self.showLoading(error) }
            self.showLoading("正在启动 LifeOS 服务…")
            self.server.waitUntilUp(timeout: 180) { ok in
                if ok { self.serverDidBecomeReady() } else {
                    self.showLoading("服务没有在 3 分钟内启动。日志：\(self.server.logURL.path)")
                }
                self.startWatchdog()
            }
        }
    }

    /// Returns an error message, or nil once the server process is launched.
    func startServer() -> String? {
        guard let repo = resolveRepoPath() else {
            return "找不到 LifeOS 仓库。用 defaults write com.lifeos.shell RepoPath /path/to/repo 设置后重开。"
        }
        do {
            try server.start(repo: repo)
            return nil
        } catch {
            return "启动服务失败：\(error.localizedDescription)"
        }
    }

    /// Takes over the old LaunchAgent's job: if nothing listens on the port, start the server.
    func startWatchdog() {
        guard watchdog == nil else { return }
        watchdog = Timer.scheduledTimer(withTimeInterval: 15, repeats: true) { [weak self] _ in
            guard let self else { return }
            self.server.health { h in
                if h == .down, !self.server.isStarting { _ = self.startServer() }
                if h == .up, self.lastHealth != .up {
                    if self.serverReady { self.reloadAll() } else { self.serverDidBecomeReady() }
                }
                self.lastHealth = h
            }
        }
    }

    func launchedAsLoginItem() -> Bool {
        guard let event = NSAppleEventManager.shared().currentAppleEvent else { return false }
        return event.eventID == kAEOpenApplication
            && event.paramDescriptor(forKeyword: keyAEPropData)?.enumCodeValue == keyAELaunchedAsLogInItem
    }

    /// First run: turn the login item on. Later runs: if it should be on but the app has
    /// moved (repo folder renamed) or the registration went missing, register this copy.
    func registerLoginItemOnFirstRun() {
        let wanted = defaults.object(forKey: "LaunchAtLogin") as? Bool ?? true
        let registeredPath = defaults.string(forKey: "LoginItemPath")
        if wanted, SMAppService.mainApp.status != .enabled || registeredPath != Bundle.main.bundlePath {
            if registeredPath != nil, registeredPath != Bundle.main.bundlePath {
                try? SMAppService.mainApp.unregister()
            }
            setLaunchAtLogin(true)
        }
        loginMenuItem.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }

    func setLaunchAtLogin(_ on: Bool) {
        do {
            if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
            defaults.set(on, forKey: "LaunchAtLogin")
            defaults.set(on ? Bundle.main.bundlePath : nil, forKey: "LoginItemPath")
        } catch {
            NSLog("LifeOS login item: \(error)")
        }
        loginMenuItem?.state = SMAppService.mainApp.status == .enabled ? .on : .off
    }

    @objc func toggleLaunchAtLogin() {
        setLaunchAtLogin(SMAppService.mainApp.status != .enabled)
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        terminating = true  // windows closing on quit must not forget the mini window state
        return .terminateNow
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showMainWindow()
        return true
    }

    func serverDidBecomeReady() {
        serverReady = true
        startWatchdog()
        mainWebView.load(URLRequest(url: baseURL))
        if defaults.bool(forKey: "MiniVisible") { setMini(visible: true) }
        statusTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.refreshStatusTitle()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 8) { self.writeDebugSnapshots() }
    }

    func showLoading(_ text: String) {
        let html = """
        <html><body style="font:14px -apple-system;color:#52525b;display:flex;height:100vh;margin:0;\
        align-items:center;justify-content:center;text-align:center;padding:0 40px">\
        <p>\(text.replacingOccurrences(of: "<", with: "&lt;"))</p></body></html>
        """
        mainWebView.loadHTMLString(html, baseURL: nil)
    }

    // MARK: Windows

    func makeWebView() -> WKWebView {
        let config = sharedWebConfig()
        config.userContentController.add(self, name: "lifeos")
        let wv = WKWebView(frame: .zero, configuration: config)
        // Treat the view as visible even when its window is covered or ordered out.
        let occlusion = Selector(("_setWindowOcclusionDetectionEnabled:"))
        if wv.responds(to: occlusion) { wv.setValue(false, forKey: "windowOcclusionDetectionEnabled") }
        wv.uiDelegate = uiDelegate
        wv.navigationDelegate = uiDelegate
        wv.allowsBackForwardNavigationGestures = true
        return wv
    }

    func buildMainWindow(show: Bool) {
        mainWebView = makeWebView()
        mainWindow = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable],
                              backing: .buffered, defer: false)
        mainWindow.title = "LifeOS"
        mainWindow.contentView = mainWebView
        mainWindow.delegate = self
        mainWindow.isReleasedWhenClosed = false
        mainWindow.center()
        mainWindow.setFrameAutosaveName("LifeOSMain")
        if show { mainWindow.makeKeyAndOrderFront(nil) }
    }

    /// Hide instead of close: the main page's PomodoroProvider owns the timer.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        if sender === mainWindow {
            mainWindow.orderOut(nil)
            return false
        }
        return true
    }

    func windowWillClose(_ notification: Notification) {
        if !terminating, (notification.object as? NSWindow) === miniPanel {
            defaults.set(false, forKey: "MiniVisible")
            miniMenuItem.state = .off
        }
    }

    @objc func showMainWindow() {
        NSApp.activate(ignoringOtherApps: true)
        mainWindow.makeKeyAndOrderFront(nil)
    }

    @objc func toggleMini() {
        setMini(visible: !(miniPanel?.isVisible ?? false))
    }

    func setMini(visible: Bool) {
        defaults.set(visible, forKey: "MiniVisible")
        miniMenuItem.state = visible ? .on : .off
        guard visible else { miniPanel?.orderOut(nil); return }
        if miniPanel == nil {
            let panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 300, height: 420),
                                styleMask: [.titled, .closable, .resizable, .utilityWindow, .nonactivatingPanel],
                                backing: .buffered, defer: false)
            panel.title = "LifeOS"
            panel.level = .floating
            panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            panel.isFloatingPanel = true
            panel.hidesOnDeactivate = false
            panel.becomesKeyOnlyIfNeeded = true
            panel.isReleasedWhenClosed = false
            panel.delegate = self
            panel.minSize = NSSize(width: 240, height: 200)
            let wv = makeWebView()
            panel.contentView = wv
            if !panel.setFrameUsingName("LifeOSMini"), let screen = NSScreen.main {
                let f = screen.visibleFrame
                panel.setFrameOrigin(NSPoint(x: f.maxX - 320, y: f.maxY - 440))
            }
            panel.setFrameAutosaveName("LifeOSMini")
            miniPanel = panel
            miniWebView = wv
        }
        if serverReady, miniWebView?.url == nil {
            miniWebView?.load(URLRequest(url: baseURL.appendingPathComponent("mini")))
        }
        miniPanel?.orderFrontRegardless()
    }

    // MARK: Menus

    func buildStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "LifeOS"
        let menu = NSMenu()
        menu.addItem(withTitle: "打开 LifeOS", action: #selector(showMainWindow), keyEquivalent: "")
        miniMenuItem = menu.addItem(withTitle: "置顶迷你窗", action: #selector(toggleMini), keyEquivalent: "")
        loginMenuItem = menu.addItem(withTitle: "登录时自动打开", action: #selector(toggleLaunchAtLogin), keyEquivalent: "")
        menu.addItem(.separator())
        menu.addItem(withTitle: "重新加载", action: #selector(reloadAll), keyEquivalent: "")
        menu.addItem(withTitle: "退出 LifeOS", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "")
        statusItem.menu = menu
    }

    func buildMainMenu() {
        let main = NSMenu()
        func submenu(_ title: String, _ items: [NSMenuItem]) {
            let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
            let m = NSMenu(title: title)
            items.forEach(m.addItem)
            item.submenu = m
            main.addItem(item)
        }
        func item(_ title: String, _ action: Selector, _ key: String, _ mods: NSEvent.ModifierFlags = .command) -> NSMenuItem {
            let i = NSMenuItem(title: title, action: action, keyEquivalent: key)
            i.keyEquivalentModifierMask = mods
            return i
        }
        submenu("LifeOS", [
            item("隐藏 LifeOS", #selector(NSApplication.hide(_:)), "h"),
            .separator(),
            item("退出 LifeOS", #selector(NSApplication.terminate(_:)), "q"),
        ])
        submenu("编辑", [
            item("撤销", Selector(("undo:")), "z"),
            item("重做", Selector(("redo:")), "z", [.command, .shift]),
            .separator(),
            item("剪切", #selector(NSText.cut(_:)), "x"),
            item("拷贝", #selector(NSText.copy(_:)), "c"),
            item("粘贴", #selector(NSText.paste(_:)), "v"),
            item("全选", #selector(NSText.selectAll(_:)), "a"),
        ])
        submenu("显示", [
            item("重新加载", #selector(reloadAll), "r"),
            item("后退", #selector(goBack), "["),
            item("前进", #selector(goForward), "]"),
            .separator(),
            item("置顶迷你窗", #selector(toggleMini), "m", [.command, .shift]),
        ])
        submenu("窗口", [
            item("最小化", #selector(NSWindow.performMiniaturize(_:)), "m"),
            item("关闭", #selector(NSWindow.performClose(_:)), "w"),
            item("LifeOS 主窗口", #selector(showMainWindow), "0"),
        ])
        NSApp.mainMenu = main
    }

    @objc func reloadAll() {
        guard serverReady else { return }
        mainWebView.reload()
        miniWebView?.reload()
    }

    @objc func goBack() { mainWebView.goBack() }
    @objc func goForward() { mainWebView.goForward() }

    // MARK: Pomodoro bridge

    /// /mini posts its commands here too; forward them to the main page, which owns the timer.
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], body["kind"] as? String == "pomodoro",
              let cmd = body["command"],
              let data = try? JSONSerialization.data(withJSONObject: cmd),
              let json = String(data: data, encoding: .utf8) else { return }
        mainWebView.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('lifeos:pomodoro-command', { detail: \(json) }))")
    }

    /// Debug aid: `defaults write com.lifeos.shell DebugSnapshotDir /some/dir` writes PNGs
    /// of both web views 8s after the server is ready (screen capture needs no permission).
    func writeDebugSnapshots() {
        guard let dir = defaults.string(forKey: "DebugSnapshotDir") else { return }
        for (name, wv) in [("main", mainWebView), ("mini", miniWebView)] {
            wv?.takeSnapshot(with: nil) { image, _ in
                guard let tiff = image?.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
                      let png = rep.representation(using: .png, properties: [:]) else { return }
                try? png.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(name).png"))
            }
        }
    }

    func refreshStatusTitle() {
        let js = "localStorage.getItem('lifeos-pomodoro-timer')"
        (miniWebView?.url != nil ? miniWebView! : mainWebView).evaluateJavaScript(js) { [weak self] result, _ in
            guard let self else { return }
            var title = "LifeOS"
            if let raw = result as? String, let data = raw.data(using: .utf8),
               let s = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                let paused = (s["pausedAt"] as? Double) != nil
                let ms = paused ? (s["remainingMs"] as? Double ?? 0)
                    : (s["endsAt"] as? Double ?? 0) - Date().timeIntervalSince1970 * 1000
                let sec = max(0, Int((ms / 1000).rounded(.up)))
                let icon = (s["phase"] as? String) == "work" ? "🍅" : "☕️"
                title = "\(icon) \(sec / 60):\(String(format: "%02d", sec % 60))\(paused ? " ⏸" : "")"
            }
            if self.statusItem.button?.title != title { self.statusItem.button?.title = title }
        }
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
