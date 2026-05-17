import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  interpolatePrompt,
  listPromptTemplates,
  readPromptTemplate,
  resolvePrompt,
} from "../src/prompts";

describe("interpolatePrompt", () => {
  it("replaces known variables", () => {
    const result = interpolatePrompt("Hello {{name}}, welcome to {{place}}.", {
      name: "Alice",
      place: "Adadex",
    });
    expect(result).toBe("Hello Alice, welcome to Adadex.");
  });

  it("leaves unknown placeholders intact", () => {
    const result = interpolatePrompt("{{known}} and {{unknown}}", { known: "yes" });
    expect(result).toBe("yes and {{unknown}}");
  });

  it("handles templates with no placeholders", () => {
    const result = interpolatePrompt("No variables here.", { foo: "bar" });
    expect(result).toBe("No variables here.");
  });
});

describe("readPromptTemplate", () => {
  let promptsDir: string;

  beforeEach(async () => {
    promptsDir = await mkdtemp(join(tmpdir(), "prompt-test-"));
  });

  afterEach(async () => {
    await rm(promptsDir, { recursive: true, force: true });
  });

  it("reads an existing template file", async () => {
    await writeFile(join(promptsDir, "greeting.md"), "Hello {{name}}!\n");
    const result = await readPromptTemplate(promptsDir, "greeting");
    expect(result).toBe("Hello {{name}}!");
  });

  it("returns undefined for missing templates", async () => {
    const result = await readPromptTemplate(promptsDir, "nonexistent");
    expect(result).toBeUndefined();
  });

  it("rejects path traversal attempts", async () => {
    const result = await readPromptTemplate(promptsDir, "../etc/passwd");
    expect(result).toBeUndefined();
  });
});

describe("resolvePrompt", () => {
  let promptsDir: string;

  beforeEach(async () => {
    promptsDir = await mkdtemp(join(tmpdir(), "prompt-test-"));
  });

  afterEach(async () => {
    await rm(promptsDir, { recursive: true, force: true });
  });

  it("reads and interpolates a template", async () => {
    await writeFile(
      join(promptsDir, "orchestration-init.md"),
      "You are the {{coordinationId}} agent.",
    );
    const result = await resolvePrompt(promptsDir, "orchestration-init", {
      coordinationId: "sandbox",
    });
    expect(result).toBe("You are the sandbox agent.");
  });

  it("returns undefined for missing templates", async () => {
    const result = await resolvePrompt(promptsDir, "missing", { coordinationId: "x" });
    expect(result).toBeUndefined();
  });
});

describe("listPromptTemplates", () => {
  let promptsDir: string;

  beforeEach(async () => {
    promptsDir = await mkdtemp(join(tmpdir(), "prompt-test-"));
  });

  afterEach(async () => {
    await rm(promptsDir, { recursive: true, force: true });
  });

  it("lists template names without .md extension", async () => {
    await writeFile(join(promptsDir, "alpha.md"), "a");
    await writeFile(join(promptsDir, "beta.md"), "b");
    await writeFile(join(promptsDir, "readme.txt"), "ignored");

    const names = await listPromptTemplates(promptsDir);
    expect(names.sort()).toEqual(["alpha", "beta"]);
  });

  it("returns empty array when directory does not exist", async () => {
    const names = await listPromptTemplates("/tmp/nonexistent-workspace");
    expect(names).toEqual([]);
  });
});
