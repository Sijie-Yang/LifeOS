// Bridges the page to the shell with the same API the macOS WKWebView exposes, so /mini
// (src/components/focus/MiniPanel.tsx) works unchanged: window.webkit.messageHandlers.lifeos.
// Also supplies window.prompt(), which Electron does not implement.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("webkit", {
  messageHandlers: {
    lifeos: { postMessage: (msg) => ipcRenderer.send("lifeos:post", msg) },
  },
});

contextBridge.exposeInMainWorld("lifeosShell", {
  platform: process.platform,
  prompt: (message, defaultText) => ipcRenderer.sendSync("lifeos:prompt", message, defaultText),
  answerPrompt: (value) => ipcRenderer.send("lifeos:prompt-answer", value),
});

contextBridge.executeInMainWorld({
  func: () => {
    window.prompt = (message, defaultText) =>
      window.lifeosShell.prompt(message == null ? "" : String(message), defaultText == null ? "" : String(defaultText));
  },
});
