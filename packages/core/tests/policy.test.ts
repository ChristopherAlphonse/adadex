import { describe, expect, it } from "vitest";

import { evaluateShell, evaluateWrite } from "../src/application/evaluatePolicy";
import type { PolicyRules } from "../src/domain/policy";

const rules: PolicyRules = {
  allow: ["ls*", "cat*", "git status*", "git diff*", "echo*", "npm test*"],
  deny: ["git push*", "git -C * push*", "curl -X POST*"],
  ask: ["git commit*", "git add*", "git -C * commit*"],
  noWrite: ["**/.env", "**/.planning/factory/**", "/repo/.github/**"],
  writeOnly: [],
};
const same = (raw: string) => raw;

describe("evaluateShell", () => {
  it("allows a command every segment of which is on the allow list", () => {
    expect(evaluateShell(rules, "git status && ls -la", same).kind).toBe("allow");
  });

  it("denies before it asks and before it allows", () => {
    expect(evaluateShell(rules, "git push origin main", same).kind).toBe("deny");
    expect(evaluateShell(rules, "git -C /x push", same).kind).toBe("deny");
  });

  it("asks for a human on mutating git verbs, even behind an allowed command", () => {
    expect(evaluateShell(rules, "git commit -m x", same).kind).toBe("ask");
    expect(evaluateShell(rules, "ls && git commit -m x", same).kind).toBe("ask");
  });

  it("needs a human for a command no rule names", () => {
    const r = evaluateShell(rules, "rm -rf node_modules", same);
    expect(r.kind).toBe("ask");
    expect(r.kind !== "allow" && r.reason).toContain("not on the allow list");
  });

  it("checks every segment of a chain, however it is joined", () => {
    for (const cmd of [
      "ls; git push",
      "ls | git push",
      "ls || git push",
      "ls\ngit push",
      "echo $(git push)",
      "echo `git push`",
    ]) {
      expect(evaluateShell(rules, cmd, same).kind).toBe("deny");
    }
  });

  it("does not read 2>&1 as a second command", () => {
    expect(evaluateShell(rules, "npm test 2>&1", same).kind).toBe("allow");
  });

  it("treats an empty command as blocked", () => {
    expect(evaluateShell(rules, "   ", same).kind).toBe("deny");
  });

  it("checks redirect targets against the write rules", () => {
    expect(evaluateShell(rules, "echo hi > /repo/.env", same).kind).toBe("deny");
    expect(evaluateShell(rules, "echo hi > /tmp/out.txt", same).kind).toBe("allow");
    expect(evaluateShell(rules, "echo hi > /dev/null", same).kind).toBe("allow");
    expect(evaluateShell(rules, 'echo hi > "/repo/.env"', same).kind).toBe("deny");
  });

  it("refuses a redirect to a path the shell would expand", () => {
    expect(evaluateShell(rules, "echo hi > $HOME/x", same).kind).toBe("deny");
  });

  it("resolves a redirect target through the caller before matching", () => {
    const resolve = (raw: string) => `/repo/${raw}`;
    expect(evaluateShell(rules, "echo hi > .github/ci.yml", resolve).kind).toBe("deny");
  });

  it("matches a pattern as a prefix, like the guard script", () => {
    expect(
      evaluateShell({ ...rules, allow: ["git status"] }, "git status --short", same).kind,
    ).toBe("allow");
  });
});

describe("evaluateWrite", () => {
  it("denies a path matching noWrite and allows others", () => {
    expect(evaluateWrite(rules, "/repo/.env").kind).toBe("deny");
    expect(evaluateWrite(rules, "/repo/app/.env").kind).toBe("deny");
    expect(evaluateWrite(rules, "/repo/.planning/factory/jobs/a/job.json").kind).toBe("deny");
    expect(evaluateWrite(rules, "/repo/src/app.ts").kind).toBe("allow");
  });

  it("with writeOnly set, denies everything outside it", () => {
    const only: PolicyRules = { ...rules, writeOnly: ["**/.planning/factory-review/**"] };
    expect(evaluateWrite(only, "/repo/src/app.ts").kind).toBe("deny");
    expect(evaluateWrite(only, "/repo/.planning/factory-review/j/x.md").kind).toBe("allow");
  });

  it("a single star does not cross a slash", () => {
    const r: PolicyRules = { ...rules, noWrite: ["/repo/*.lock"] };
    expect(evaluateWrite(r, "/repo/a.lock").kind).toBe("deny");
    expect(evaluateWrite(r, "/repo/sub/a.lock").kind).toBe("allow");
  });
});

describe("findProtectedHits", () => {
  it("flags CI, hook, env and owner files and leaves ordinary code alone", async () => {
    const { findProtectedHits, PROTECTED_FLOOR } = await import("../src/index");
    const files = [
      ".github/workflows/ci.yml",
      "src/app.ts",
      ".env",
      "apps/web/.env.local",
      ".husky/pre-commit",
      "docs/readme.md",
      "CODEOWNERS",
      "pkg/CODEOWNERS",
    ];
    expect(findProtectedHits(files, PROTECTED_FLOOR)).toEqual([
      ".github/workflows/ci.yml",
      ".env",
      "apps/web/.env.local",
      ".husky/pre-commit",
      "CODEOWNERS",
      "pkg/CODEOWNERS",
    ]);
  });
});
