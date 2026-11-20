import { isString } from "../src/util/typeCoercion";
import { describe, expect, it } from "vitest";

import { authorize, createActionRegistry } from "../src/application/actionRegistry";
import { type ActionDef, FACTORY_ACTIONS } from "../src/domain/action";

const parseText = (input: unknown): string => {
  if (!isString(input) || input === "") throw new Error("expected a non-empty string");

  return input;
};

const act = (over: Partial<ActionDef<string>> = {}): ActionDef<string> => ({
  id: "demo.run",
  title: "Demo",
  touches: ["process"],
  class: "free",
  parse: parseText,
  ...over,
});

describe("createActionRegistry", () => {
  it("rejects a duplicate id", () => {
    expect(() => createActionRegistry([act(), act()])).toThrow(/duplicate/);
  });

  it("refuses to register an action that reaches a git remote", () => {
    expect(() =>
      createActionRegistry([act({ id: "remote.sync", touches: ["git-remote"] })]),
    ).toThrow(/remote/);
    expect(() => createActionRegistry([act({ id: "innocent", touches: ["git-remote"] })])).toThrow(
      /remote/,
    );
  });

  it("refuses the ids that open a PR or push, whatever they touch", () => {
    expect(() => createActionRegistry([act({ id: "pr.open" })])).toThrow(/never/);
    expect(() => createActionRegistry([act({ id: "git.push" })])).toThrow(/never/);
  });
});

describe("authorize", () => {
  const registry = createActionRegistry([
    act(),
    act({ id: "demo.ask", class: "ask" }),
    act({ id: "demo.human", class: "human", touches: ["git"] }),
  ]);

  const agent = { caller: "agent" } as const;

  it("denies an unknown action", () => {
    expect(authorize(registry, "nope", "x", agent).kind).toBe("deny");
  });

  it("denies input that fails the action's own check, without running it", () => {
    const r = authorize(registry, "demo.run", "", agent);
    expect(r.kind).toBe("deny");
    expect(r.kind === "deny" && r.reason).toContain("non-empty");
  });

  it("runs a free action for an agent", () => {
    const r = authorize(registry, "demo.run", "hi", agent);
    expect(r).toEqual({ kind: "run", input: "hi" });
  });

  it("makes an agent wait for approval on an ask action, then runs once approved", () => {
    expect(authorize(registry, "demo.ask", "x", agent).kind).toBe("ask");

    const approved = authorize(registry, "demo.ask", "x", {
      caller: "agent",
      approvedActionId: "demo.ask",
    });

    expect(approved.kind).toBe("run");
  });

  it("an approval for one action does not approve another", () => {
    const r = authorize(registry, "demo.ask", "x", {
      caller: "agent",
      approvedActionId: "demo.run",
    });

    expect(r.kind).toBe("ask");
  });

  it("a human-class action never runs for an agent, even with an approval", () => {
    const r = authorize(registry, "demo.human", "x", {
      caller: "agent",
      approvedActionId: "demo.human",
    });

    expect(r.kind).toBe("needs-human-click");
  });

  it("a human-class action runs only with a human click for that action", () => {
    const human = (actionId: string) => ({ caller: "human", humanClick: { actionId } }) as const;
    expect(authorize(registry, "demo.human", "x", { caller: "human" }).kind).toBe(
      "needs-human-click",
    );
    expect(authorize(registry, "demo.human", "x", human("demo.run")).kind).toBe(
      "needs-human-click",
    );
    expect(authorize(registry, "demo.human", "x", human("demo.human")).kind).toBe("run");
  });
});

describe("FACTORY_ACTIONS", () => {
  const registry = createActionRegistry(FACTORY_ACTIONS);

  it("registers cleanly", () => {
    expect(registry.has("job.advance")).toBe(true);
  });

  it("keeps approve, commit and unblock as human clicks only", () => {
    for (const id of ["job.approve_spec", "job.commit_local", "job.unblock"]) {
      expect(registry.get(id)?.class).toBe("human");
    }
  });

  it("has no action that pushes or opens a PR", () => {
    const ids = FACTORY_ACTIONS.map((a) => a.id);
    expect(ids.some((id) => /push|pr\./.test(id))).toBe(false);
    expect(FACTORY_ACTIONS.some((a) => a.touches.includes("git-remote"))).toBe(false);
  });

  it("lets an agent advance a job but not approve its spec", () => {
    const agent = { caller: "agent" } as const;
    expect(authorize(registry, "job.advance", { id: "j1", to: "spec" }, agent).kind).toBe("run");
    expect(authorize(registry, "job.approve_spec", { id: "j1" }, agent).kind).toBe(
      "needs-human-click",
    );
  });

  it("rejects a malformed job id", () => {
    expect(
      authorize(registry, "job.advance", { id: "Bad Id", to: "spec" }, { caller: "agent" }).kind,
    ).toBe("deny");
  });
});
