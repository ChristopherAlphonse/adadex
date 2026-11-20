import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, session, Tray } from "electron";
import { type App, createApp } from "../app/createApp";
import type { HostEvent, NativeConfirm } from "../host/actionHost";

const here = dirname(fileURLToPath(import.meta.url));
const PAGE = join(here, "web", "index.html");
const PAGE_URL = pathToFileURL(PAGE).href;
const SMOKE = process.env.ADADEX_SMOKE === "1";

let core: App | undefined;
let win: BrowserWindow | undefined;
let tray: Tray | undefined;
let quitting = false;
const smokeLog: string[] = [];

/** The native OS dialog. It is the only thing that can say yes to a human-only action, and the page cannot press it. */
const confirm: NativeConfirm = async (title, detail) => {
  if (SMOKE) {
    smokeLog.push(`native dialog: ${title}`);
    return false;
  }
  const options = {
    type: "question" as const,
    buttons: ["Cancel", "Run"],
    defaultId: 0,
    cancelId: 0,
    title,
    message: title,
    detail,
    noLink: true,
  };
  const result = win
    ? await dialog.showMessageBox(win, options)
    : await dialog.showMessageBox(options);
  return result.response === 1;
};

const updateTray = (): void => {
  const waiting = core?.approvals.pending().length ?? 0;
  tray?.setTitle(waiting > 0 ? `adadex (${waiting})` : "adadex");
};

const emit = (event: HostEvent): void => {
  if (win && !win.isDestroyed()) win.webContents.send("adadex:event", event);
  updateTray();
};

const createWindow = (): BrowserWindow => {
  const w = new BrowserWindow({
    width: 900,
    height: 640,
    show: !SMOKE,
    webPreferences: {
      preload: join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  w.webContents.on("will-navigate", (e) => e.preventDefault());
  return w;
};

const smoke = async (w: BrowserWindow): Promise<void> => {
  const run = (code: string) => w.webContents.executeJavaScript(code);
  const result = {
    workflows: await run(`window.adadex.request({kind:"workflows.list"})`),
    garbage: await run(`window.adadex.request({kind:"rm -rf"})`),
    humanOnly: await run(
      `window.adadex.request({kind:"action.run",actionId:"job.commit_local",input:{id:"j1"}})`,
    ),
    push: await run(`window.adadex.request({kind:"action.run",actionId:"git.push",input:{}})`),
  };
  // A page that is not ours gets the same bridge and must be refused.
  const stranger = new BrowserWindow({
    show: false,
    webPreferences: { preload: join(here, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  await stranger.loadURL("data:text/html,<title>x</title>");
  const forged = await stranger.webContents.executeJavaScript(
    `window.adadex.request({kind:"workflows.list"})`,
  );
  const names = (result.workflows as { data: { id: string }[] }).data.map((x) => x.id);
  console.log(
    `SMOKE_RESULT ${JSON.stringify({ names, garbage: result.garbage, humanOnly: result.humanOnly, push: result.push, forged, dialogs: smokeLog })}`,
  );
};

const boot = async (): Promise<void> => {
  const projectRoot = process.env.ADADEX_PROJECT ?? process.cwd();
  const dataDir =
    process.env.ADADEX_DATA ??
    (SMOKE
      ? await mkdtemp(join(tmpdir(), "adadex-smoke-"))
      : join(app.getPath("userData"), "adadex"));
  await mkdir(dataDir, { recursive: true });

  core = createApp({
    projectRoot,
    dataDir,
    confirm,
    emit,
    bridgePath: join(here, "mcp-bridge.mjs"),
    hookPath: join(here, "guard-hook.mjs"),
  });
  const api = core.api;

  session.defaultSession.setPermissionRequestHandler((_w, _p, callback) => callback(false));
  ipcMain.handle("adadex:request", async (event, raw: unknown) => {
    if (event.senderFrame?.url !== PAGE_URL) return { ok: false, errors: ["untrusted sender"] };
    return api.handle(raw);
  });

  win = createWindow();
  await win.loadFile(PAGE);

  if (SMOKE) {
    const watchdog = setTimeout(() => app.exit(2), 30000);
    await smoke(win);
    clearTimeout(watchdog);
    quitting = true;
    await core.shutdown();
    app.exit(0);
    return;
  }

  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("adadex");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open adadex", click: () => (win && !win.isDestroyed() ? win.show() : undefined) },
      { type: "separator" },
      { label: "Quit and stop everything", click: () => app.quit() },
    ]),
  );
};

app.on("before-quit", (event) => {
  if (quitting || !core) return;
  event.preventDefault();
  quitting = true;
  void core.shutdown().finally(() => app.quit());
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.whenReady().then(boot);
