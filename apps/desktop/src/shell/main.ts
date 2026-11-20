import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  powerSaveBlocker,
  safeStorage,
  session,
  Tray,
} from "electron";
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

/** Drives the real factory board the way a person would: open it, find a job, press buttons. */
const smokeBoard = async (w: BrowserWindow): Promise<unknown> => {
  await w.webContents.executeJavaScript(
    `window.adadex.request({kind:"jobs.create",workflowId:"factory",id:"smoke-job",title:"Smoke job"})`,
  );
  const inPage = await w.webContents.executeJavaScript(`(async () => {
    const until = async (check, what) => {
      for (const t0 = Date.now(); Date.now() - t0 < 10000; await new Promise((r) => setTimeout(r, 50))) {
        const found = check();
        if (found) return found;
      }
      throw new Error("timed out waiting for " + what);
    };
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "8" }));
    const view = await until(() => document.querySelector('[aria-label="Factory primary view"]'), "factory view");
    const card = await until(() => view.querySelector('[aria-label="Job Smoke job"]'), "job card");
    const stage = card.closest('section[aria-label^="Stage "]').getAttribute("aria-label");
    view.querySelector('[aria-label="Move to spec for Smoke job"]').click();
    const refused = (await until(() => view.querySelector('[role="alert"]'), "refusal")).textContent;
    const loop = await until(() => [...view.querySelectorAll("button")].find((b) => b.textContent.startsWith("Unattended loop")), "loop toggle");
    loop.click();
    const declined = await until(() => view.querySelector('[role="alert"]')?.textContent.includes("declined") && view.querySelector('[role="alert"]').textContent, "loop declined");
    return { stage, refused, declined, loopAfter: loop.textContent };
  })()`);
  const jobs = (await w.webContents.executeJavaScript(
    `window.adadex.request({kind:"jobs.list"})`,
  )) as { data: { id: string; stage: string }[] };
  return { ...inPage, stageAfter: jobs.data.find((j) => j.id === "smoke-job")?.stage };
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
  const stranger = new BrowserWindow({
    show: false,
    webPreferences: { preload: join(here, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  await stranger.loadURL("data:text/html,<title>x</title>");
  const forged = await stranger.webContents.executeJavaScript(
    `window.adadex.request({kind:"workflows.list"})`,
  );
  const names = (result.workflows as { data: { id: string }[] }).data.map((x) => x.id);
  const board = await smokeBoard(w);
  console.log(
    `SMOKE_RESULT ${JSON.stringify({ names, garbage: result.garbage, humanOnly: result.humanOnly, push: result.push, forged, board, dialogs: smokeLog })}`,
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

  // The audit signing key is wrapped by the operating system keychain when there is one.
  const keyProtector = safeStorage.isEncryptionAvailable()
    ? {
        protect: (plain: Buffer) => safeStorage.encryptString(plain.toString("utf8")),
        unprotect: (stored: Buffer) => Buffer.from(safeStorage.decryptString(stored), "utf8"),
      }
    : undefined;
  // Keep the machine awake while an agent or a check is running, so unattended work is not cut off by sleep.
  let blocker: number | undefined;

  core = createApp({
    ...(keyProtector ? { keyProtector } : {}),
    onBusyChange: (busy) => {
      if (busy && blocker === undefined) blocker = powerSaveBlocker.start("prevent-app-suspension");
      if (!busy && blocker !== undefined) {
        powerSaveBlocker.stop(blocker);
        blocker = undefined;
      }
    },
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
    core.close();
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
  void core.shutdown().finally(() => {
    core?.close();
    app.quit();
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.whenReady().then(boot);
