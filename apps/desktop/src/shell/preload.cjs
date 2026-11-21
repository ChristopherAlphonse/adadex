// Runs in the window before the page, with no access to Node. It exposes exactly two things to the page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("adadex", {
  request: (request) => ipcRenderer.invoke("adadex:request", request),
  onEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("adadex:event", listener);

    return () => ipcRenderer.removeListener("adadex:event", listener);
  },
});
