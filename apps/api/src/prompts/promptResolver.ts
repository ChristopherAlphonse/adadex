import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Interpolate `{{key}}` placeholders in a template string with values from the
 * provided variables map. Unknown placeholders are left as-is.
 */
export const interpolatePrompt = (template: string, variables: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => variables[key] ?? match);

/**
 * Read a prompt template from `<promptsDir>/<name>.md` and return the raw
 * template string. Returns `undefined` if the file does not exist.
 */
export const readPromptTemplate = async (
  promptsDir: string,
  name: string,
): Promise<string | undefined> => {
  // Guard against path traversal.
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    return undefined;
  }

  const filePath = join(promptsDir, `${name}.md`);

  try {
    const content = await readFile(filePath, "utf-8");
    return content.trimEnd();
  } catch {
    return undefined;
  }
};

/**
 * Read and resolve a prompt template, interpolating the given variables.
 * Returns `undefined` if the template does not exist.
 */
export const resolvePrompt = async (
  promptsDir: string,
  name: string,
  variables: Record<string, string>,
): Promise<string | undefined> => {
  const template = await readPromptTemplate(promptsDir, name);
  if (template === undefined) {
    return undefined;
  }
  return interpolatePrompt(template, variables);
};

/**
 * List all available prompt template names (file basenames without `.md`).
 */
export const listPromptTemplates = async (promptsDir: string): Promise<string[]> => {
  try {
    const entries = await readdir(promptsDir);
    return entries.filter((e) => e.endsWith(".md")).map((e) => e.replace(/\.md$/, ""));
  } catch {
    return [];
  }
};

// ─── Multi-directory helpers (builtin + user) ─────────────────────────────

type PromptEntry = { name: string; source: "builtin" | "user" };

/**
 * List prompts from both built-in and user directories.
 * User prompts shadow built-in prompts with the same name.
 */
export const listAllPrompts = async (
  builtinDir: string,
  userDir: string,
): Promise<PromptEntry[]> => {
  const [builtinNames, userNames] = await Promise.all([
    listPromptTemplates(builtinDir),
    listPromptTemplates(userDir),
  ]);

  const seen = new Set<string>();
  const result: PromptEntry[] = [];

  for (const name of userNames) {
    seen.add(name);
    result.push({ name, source: "user" });
  }
  for (const name of builtinNames) {
    if (!seen.has(name)) {
      result.push({ name, source: "builtin" });
    }
  }

  return result;
};

/**
 * Read a prompt from user dir first, falling back to builtin dir.
 */
export const readPromptFromDirs = async (
  builtinDir: string,
  userDir: string,
  name: string,
): Promise<{ name: string; source: "builtin" | "user"; content: string } | undefined> => {
  const userContent = await readPromptTemplate(userDir, name);
  if (userContent !== undefined) {
    return { name, source: "user", content: userContent };
  }
  const builtinContent = await readPromptTemplate(builtinDir, name);
  if (builtinContent !== undefined) {
    return { name, source: "builtin", content: builtinContent };
  }
  return undefined;
};

const VALID_PROMPT_NAME = /^[\w][\w.-]*$/;

/**
 * Write a user prompt to the user prompts directory.
 */
export const writeUserPrompt = async (
  userDir: string,
  name: string,
  content: string,
): Promise<boolean> => {
  if (!VALID_PROMPT_NAME.test(name) || name.includes("..")) {
    return false;
  }
  await mkdir(userDir, { recursive: true });
  await writeFile(join(userDir, `${name}.md`), content, "utf-8");
  return true;
};

/**
 * Delete a user prompt from the user prompts directory.
 */
export const deleteUserPrompt = async (userDir: string, name: string): Promise<boolean> => {
  if (!VALID_PROMPT_NAME.test(name) || name.includes("..")) {
    return false;
  }
  try {
    await rm(join(userDir, `${name}.md`));
    return true;
  } catch {
    return false;
  }
};
