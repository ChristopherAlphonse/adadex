import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { factoryBuildPreset } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createJobStore } from "../src/jobs/jobStore";
import { createFileAnchors } from "../src/logs/anchors";
import { type AuditExport, verifyAuditExport } from "../src/logs/auditExport";
import { GENESIS, lineHash, openLogDb } from "../src/logs/logDb";
import { createFileSigner, type KeyProtector, verifySignature } from "../src/logs/signer";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-signing-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("the signing key", () => {
  it("is made once, kept private to the owner, and the same after a restart", async () => {
    const a = createFileSigner(join(root, "keys"));
    const b = createFileSigner(join(root, "keys"));
    expect(b.keyId).toBe(a.keyId);
    expect((await stat(join(root, "keys", "audit-signing.key"))).mode & 0o777).toBe(0o600);
    expect((await stat(join(root, "keys"))).mode & 0o777).toBe(0o700);
    expect(verifySignature(a.publicKey, "hello", a.sign("hello"))).toBe(true);
    expect(verifySignature(a.publicKey, "hellp", a.sign("hello"))).toBe(false);
    expect(
      verifySignature(
        /* SAFETY: preceding checks establish the invariant this assertion encodes. */ generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }) as string,
        "hello",
        a.sign("hello"),
      ),
    ).toBe(false);
    expect(verifySignature("not a key", "hello", a.sign("hello"))).toBe(false);
  });

  it("is stored wrapped when a key protector is given, so the file holds no readable key", async () => {
    const xor: KeyProtector = {
      protect: (b) => Buffer.from(b.map((x) => x ^ 0x5a)),
      unprotect: (b) => Buffer.from(b.map((x) => x ^ 0x5a)),
    };

    const a = createFileSigner(join(root, "keys"), xor);
    expect((await readFile(join(root, "keys", "audit-signing.key"))).toString()).not.toContain(
      "PRIVATE KEY",
    );
    const again = createFileSigner(join(root, "keys"), xor);
    expect(again.keyId).toBe(a.keyId);
    expect(verifySignature(a.publicKey, "x", again.sign("x"))).toBe(true);
  });
});

const setup = async () => {
  const path = join(root, "logs", "adadex.db");
  const logDb = openLogDb(path);
  const signer = createFileSigner(join(root, "keys"));
  const anchors = createFileAnchors(join(root, "anchors", "a.log"));

  const store = createJobStore(join(root, "state"), () => new Date("2026-11-19T00:00:00.000Z"), {
    db: logDb,
    project: "p",
    signer,
    anchors,
    user: "alice",
  });

  await store.create(factoryBuildPreset, "j1", "t", 3);

  const attacker = () => {
    const db = new DatabaseSync(path);
    db.exec("DROP TRIGGER audit_no_update; DROP TRIGGER audit_no_delete;");

    return db;
  };

  return { store, logDb, signer, anchors, attacker };
};

describe("signed audit lines", () => {
  it("signs every line, and verifies", async () => {
    const { store, logDb, signer } = await setup();
    await store.audit({ actor: "agent", action: "note", jobId: "j1", detail: "x" });
    const rows = logDb.auditRows("p", "j1");
    expect(rows.every((r) => r.sig !== undefined && r.keyId === signer.keyId)).toBe(true);
    expect(await store.verify("j1")).toEqual({ ok: true, entries: 2 });
  });

  it("catches someone who rewrites the whole chain consistently but does not have the key", async () => {
    const { store, logDb, attacker } = await setup();
    await store.audit({ actor: "agent", action: "note", jobId: "j1", detail: "original" });
    // Edit a line, then recompute every hash after it so the chain links up again. Without the key, the signatures cannot follow.
    const db = attacker();
    const rows = logDb.auditRows("p", "j1");
    let prev = GENESIS;

    for (const r of rows) {
      const detail = r.seq === 2 ? "rewritten" : r.detail;
      const hash = lineHash(prev, { ...r, detail });
      db.prepare("UPDATE audit SET detail = ?, prev = ?, hash = ? WHERE seq = ?").run(
        detail,
        prev,
        hash,
        r.seq,
      );
      prev = hash;
    }

    const result = await store.verify("j1");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toContain("signature that does not verify");
  });

  it("catches lines re-signed with the attacker's own key, and lines that were never signed", async () => {
    const { store, logDb, attacker } = await setup();
    const own = createFileSigner(join(root, "other-keys"));
    const db = attacker();
    const [first] = logDb.auditRows("p", "j1");
    db.prepare("UPDATE audit SET sig = ?, key_id = ? WHERE seq = ?").run(
      own.sign(first?.hash ?? ""),
      own.keyId,
      first?.seq ?? 0,
    );
    expect((await store.verify("j1")).ok).toBe(false);
    db.prepare("UPDATE audit SET sig = NULL, key_id = NULL WHERE seq = ?").run(first?.seq ?? 0);
    const unsigned = await store.verify("j1");
    expect(unsigned.ok === false && unsigned.reason).toContain("not signed by this machine's key");
  });
});

describe("anchors catch removed lines", () => {
  it("notices lines removed from the end of a chain, which the chain and the signatures alone cannot", async () => {
    const { store, attacker } = await setup();
    await store.audit({ actor: "agent", action: "note", jobId: "j1", detail: "one" });
    await store.audit({ actor: "agent", action: "note", jobId: "j1", detail: "two" });
    expect((await store.verify("j1")).ok).toBe(true);
    attacker().exec("DELETE FROM audit WHERE seq = 3");
    const result = await store.verify("j1");
    expect(result).toEqual({
      ok: false,
      reason: "audit lines were removed: the anchor names a line that is gone",
    });
  });

  it("keeps the newest line of each job, ignores a damaged line, and says nothing for a job it has not seen", async () => {
    const path = join(root, "anchors.log");
    const anchors = createFileAnchors(path);
    anchors.append({ project: "p", jobId: "a", seq: 1, hash: "h1", ts: "t" });
    anchors.append({ project: "p", jobId: "a", seq: 3, hash: "h3", ts: "t" });
    anchors.append({ project: "p", jobId: "b", seq: 9, hash: "h9", ts: "t" });
    expect(anchors.latest("p", "a")?.seq).toBe(3);
    expect(anchors.latest("p", "zzz")).toBeNull();
    expect(anchors.latest("q", "a")).toBeNull();
    expect(createFileAnchors(join(root, "missing.log")).latest("p", "a")).toBeNull();
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});

describe("offline verification by an auditor", () => {
  it("verifies an export with only the public key, and rejects an edited or re-keyed one", async () => {
    const { store } = await setup();
    await store.audit({ actor: "human", action: "commit", jobId: "j1", detail: "abc" });
    const exported = store.exportAudit("j1");
    expect(verifyAuditExport(exported)).toEqual({ ok: true, entries: 2 });

    const edited: AuditExport = {
      ...exported,
      rows: exported.rows.map((r, i) => (i === 1 ? { ...r, detail: "different" } : r)),
    };

    expect(verifyAuditExport(edited).ok).toBe(false);

    const other = createFileSigner(join(root, "other-keys"));
    expect(
      verifyAuditExport({ ...exported, publicKey: other.publicKey, keyId: other.keyId }).ok,
    ).toBe(false);
    expect(verifyAuditExport({ ...exported, rows: [...exported.rows].reverse() }).ok).toBe(false);
  });
});

describe("who did it", () => {
  it("writes the operating system user on human actions and not on agent ones", async () => {
    const { store, logDb } = await setup();
    await store.audit({
      actor: "human",
      action: "commit",
      jobId: "j1",
      detail: "abc",
      data: { round: 1 },
    });
    await store.audit({ actor: "agent", action: "note", jobId: "j1", detail: "x" });
    const rows = logDb.auditRows("p", "j1");
    expect(rows[1]?.data).toEqual({ round: 1, user: "alice" });
    expect(rows[2]?.data).toBeUndefined();
  });
});

describe("opening an older database", () => {
  it("adds the signature columns and keeps the old lines", () => {
    const path = join(root, "old.db");
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE audit (seq INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT NOT NULL, job_id TEXT NOT NULL, ts TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL, role TEXT, run_id TEXT, data TEXT, state TEXT NOT NULL, prev TEXT NOT NULL, hash TEXT NOT NULL, UNIQUE (project, job_id, prev));
      INSERT INTO audit (project, job_id, ts, actor, action, detail, state, prev, hash) VALUES ('p','j1','t','system','create','x','s','${GENESIS}','h'); PRAGMA user_version = 1;`);
    old.close();
    const logDb = openLogDb(path);
    expect(logDb.auditRows("p", "j1")).toHaveLength(1);
    expect(
      (/* SAFETY: preceding checks establish the invariant this assertion encodes. */ logDb.db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version,
    ).toBe(2);
    logDb.appendAudit(
      "p",
      { ts: "t", actor: "system", action: "n", jobId: "j1", detail: "d", state: "s" },
      { sign: () => "sig", keyId: "k" },
    );
    expect(logDb.auditRows("p", "j1")[1]?.sig).toBe("sig");
  });
});
