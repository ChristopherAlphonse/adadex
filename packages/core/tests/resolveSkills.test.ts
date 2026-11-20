import { describe, expect, it } from "vitest";

import { resolveSkills } from "../src/application/resolveSkills";
import type { SkillInfo } from "../src/ports/SkillCatalog";
import { factoryBuildPreset } from "../src/presets";

const skill = (name: string, source = "calphonse-skills"): SkillInfo => ({
  name,
  path: `/skills/${name}/SKILL.md`,
  source,
});

describe("resolveSkills", () => {
  it("resolves a stage's skills by name from whatever the machine has", () => {
    const r = resolveSkills(factoryBuildPreset, [skill("prd-mode"), skill("swe")], {});
    const spec = r.find((x) => x.stageId === "spec");
    expect(spec).toMatchObject({
      ref: { name: "prd-mode" },
      via: "name",
      skill: { name: "prd-mode" },
    });
  });

  it("reports a skill the machine does not have, instead of failing", () => {
    const r = resolveSkills(factoryBuildPreset, [skill("swe")], {});
    const missing = r.filter((x) => x.skill === null).map((x) => x.ref.name);
    expect(missing).toContain("prd-mode");
    expect(missing).not.toContain("swe");
  });

  it("lets a machine map a workflow's skill name to its own skill", () => {
    const acme = skill("acme-spec-writer", "acme-enterprise");
    const r = resolveSkills(factoryBuildPreset, [acme, skill("prd-mode")], {
      "prd-mode": "acme-spec-writer",
    });
    const spec = r.find((x) => x.stageId === "spec");
    expect(spec).toMatchObject({
      via: "map",
      skill: { name: "acme-spec-writer", source: "acme-enterprise" },
    });
  });

  it("a mapping to a skill that is not installed is reported missing, not silently replaced", () => {
    const r = resolveSkills(factoryBuildPreset, [skill("prd-mode")], {
      "prd-mode": "acme-spec-writer",
    });
    expect(r.find((x) => x.stageId === "spec")?.skill).toBeNull();
  });

  it("returns nothing for stages without skills", () => {
    const r = resolveSkills(factoryBuildPreset, [], {});
    expect(r.some((x) => x.stageId === "gate")).toBe(false);
  });
});
