import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { factoryBuildPreset, resolveSkills } from "@adadex/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  loadMachineConfig,
  parseMachineConfig,
  saveMachineConfig,
} from "../src/config/machineConfig";
import { createFsSkillCatalog, frontMatterName } from "../src/skills/fsSkillCatalog";
import { createWorkflowStore } from "../src/workflows/workflowStore";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "adadex-storage-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const skill = async (dir: string, folder: string, body: string) => {
  await mkdir(join(dir, folder), { recursive: true });
  await writeFile(join(dir, folder, "SKILL.md"), body);
};

describe("frontMatterName", () => {
  it("reads name from front matter, with or without quotes", () => {
    expect(frontMatterName("---\nname: prd-mode\ndescription: x\n---\nbody")).toBe("prd-mode");
    expect(frontMatterName('---\nname: "spec writer"\n---\n')).toBe("spec writer");
    expect(frontMatterName("no front matter")).toBeNull();
  });
});

describe("fs skill catalog", () => {
  it("lists skills from every configured folder and ships none of its own", async () => {
    const a = join(root, "a");
    const b = join(root, "b");
    await skill(a, "swe", "---\nname: swe\n---\n");
    await skill(b, "acme-spec", "---\nname: acme-spec-writer\n---\n");

    const list = await createFsSkillCatalog([
      { name: "base", dir: a },
      { name: "acme", dir: b },
    ]).list();

    expect(list.map((s) => [s.name, s.source])).toEqual([
      ["swe", "base"],
      ["acme-spec-writer", "acme"],
    ]);
    expect(await createFsSkillCatalog([]).list()).toEqual([]);
  });

  it("falls back to the folder name, skips folders with no SKILL.md, and ignores a missing source", async () => {
    const a = join(root, "a");
    await skill(a, "plain", "no front matter");
    await mkdir(join(a, "empty"), { recursive: true });

    const list = await createFsSkillCatalog([
      { name: "a", dir: a },
      { name: "gone", dir: join(root, "nope") },
    ]).list();

    expect(list.map((s) => s.name)).toEqual(["plain"]);
  });

  it("lets the earlier folder win when two folders have the same skill", async () => {
    const a = join(root, "a");
    const b = join(root, "b");
    await skill(a, "x", "---\nname: prd-mode\n---\n");
    await skill(b, "y", "---\nname: prd-mode\n---\n");

    const list = await createFsSkillCatalog([
      { name: "mine", dir: a },
      { name: "base", dir: b },
    ]).list();

    expect(list).toHaveLength(1);
    expect(list[0]?.source).toBe("mine");
  });

  it("feeds resolveSkills, so an enterprise machine can map a name to its own skill", async () => {
    const dir = join(root, "ent");
    await skill(dir, "spec", "---\nname: acme-spec-writer\n---\n");
    const available = await createFsSkillCatalog([{ name: "acme", dir }]).list();

    const spec = resolveSkills(factoryBuildPreset, available, {
      "prd-mode": "acme-spec-writer",
    }).find((r) => r.stageId === "spec");

    expect(spec).toMatchObject({ via: "map", skill: { source: "acme" } });
  });
});

describe("workflow store", () => {
  const mine = () => ({
    id: "my-flow",
    name: "My flow",
    initial: "draft",
    stages: [
      { id: "draft", hint: "write", moves: [{ to: "done" }] },
      { id: "done", hint: "end", terminal: true, moves: [] },
    ],
  });

  it("lists the two presets first, then the user's workflows", async () => {
    const store = createWorkflowStore(join(root, "wf"));
    expect((await store.list()).map((w) => w.id)).toEqual(["factory", "factory-review"]);
    expect((await store.save(mine())).ok).toBe(true);
    expect((await store.list()).map((w) => w.id)).toEqual(["factory", "factory-review", "my-flow"]);
    expect((await store.get("my-flow"))?.origin).toBe("user");
  });

  it("refuses an invalid workflow and writes nothing", async () => {
    const store = createWorkflowStore(join(root, "wf"));
    const r = await store.save({ ...mine(), initial: "zzz" });
    expect(r.ok).toBe(false);
    expect((await store.list()).map((w) => w.id)).toEqual(["factory", "factory-review"]);
  });

  it("never lets a save overwrite or remove a preset", async () => {
    const store = createWorkflowStore(join(root, "wf"));
    const r = await store.save({ ...mine(), id: "factory" });
    expect(r.ok === false && r.errors[0]).toContain("is a preset");
    expect((await store.remove("factory")).ok).toBe(false);
  });

  it("forks a preset under a new id as an editable user workflow", async () => {
    const store = createWorkflowStore(join(root, "wf"));
    const r = await store.fork("factory", "acme-build", "Acme build");
    expect(r.ok && r.workflow.origin).toBe("user");
    expect(r.ok && r.workflow.stages.length).toBe(factoryBuildPreset.stages.length);
    expect((await store.fork("factory", "acme-build", "again")).ok).toBe(false);
    expect((await store.fork("nope", "x", "x")).ok).toBe(false);
  });

  it("removes a user workflow but not one that does not exist", async () => {
    const store = createWorkflowStore(join(root, "wf"));
    await store.save(mine());
    expect((await store.remove("my-flow")).ok).toBe(true);
    expect(await store.get("my-flow")).toBeUndefined();
    expect((await store.remove("my-flow")).ok).toBe(false);
  });

  it("ignores a file on disk that is corrupt, invalid, or tries to shadow a preset", async () => {
    const dir = join(root, "wf");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "bad.json"), "{not json");
    await writeFile(join(dir, "invalid.json"), JSON.stringify({ id: "x" }));
    await writeFile(join(dir, "factory.json"), JSON.stringify({ ...mine(), id: "factory" }));
    const store = createWorkflowStore(dir);
    expect((await store.list()).map((w) => w.id)).toEqual(["factory", "factory-review"]);
    expect((await store.get("factory"))?.origin).toBe("preset");
  });
});

describe("machine config", () => {
  it("defaults to nothing when there is no file or it is corrupt", async () => {
    expect(await loadMachineConfig(join(root, "none.json"))).toEqual({
      skillSources: [],
      skillMap: {},
    });
    await writeFile(join(root, "bad.json"), "{nope");
    expect(await loadMachineConfig(join(root, "bad.json"))).toEqual({
      skillSources: [],
      skillMap: {},
    });
  });

  it("saves and loads sources and the skill map", async () => {
    const path = join(root, "cfg", "machine.json");

    const input = {
      skillSources: [{ name: "acme", dir: "/skills/acme" }],
      skillMap: { "prd-mode": "acme-spec-writer" },
    };

    expect((await saveMachineConfig(path, input)).ok).toBe(true);
    expect(await loadMachineConfig(path)).toEqual(input);
  });

  it("reports every problem and does not write a bad config", async () => {
    const bad = {
      skillSources: [{ name: "a" }, { name: "x", dir: "/p" }, { name: "x", dir: "/q" }],
      skillMap: { k: "" },
    };

    const r = parseMachineConfig(bad);
    expect(r.ok === false && r.errors).toEqual([
      "skill source 1 needs a name and a dir",
      "skill source names must be unique",
      "skill map entry k needs a skill name",
    ]);
    const path = join(root, "cfg.json");
    expect((await saveMachineConfig(path, bad)).ok).toBe(false);
    expect(await loadMachineConfig(path)).toEqual({ skillSources: [], skillMap: {} });
  });
});
