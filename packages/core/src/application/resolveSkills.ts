import type { SkillRef, WorkflowDefinition } from "../domain/workflow";
import type { SkillInfo } from "../ports/SkillCatalog";

export interface ResolvedSkill {
  readonly stageId: string;
  readonly ref: SkillRef;
  /** The skill that will be used, or null when this machine does not have one. */
  readonly skill: SkillInfo | null;
  readonly via: "name" | "map";
}

/**
 * Match each stage's skill names to the skills on this machine. `skillMap` is the machine's own
 * overrides (for example an enterprise machine maps `prd-mode` to its own spec skill), so a shared
 * workflow works anywhere without editing it. A name with no match is reported, never guessed.
 */
export const resolveSkills = (
  def: WorkflowDefinition,
  available: readonly SkillInfo[],
  skillMap: Readonly<Record<string, string>>,
): readonly ResolvedSkill[] => {
  const byName = new Map(available.map((s) => [s.name, s]));

  return def.stages.flatMap((stage) =>
    (stage.skills ?? []).map((ref): ResolvedSkill => {
      const mapped = skillMap[ref.name];
      const wanted = mapped ?? ref.name;

      return {
        stageId: stage.id,
        ref,
        skill: byName.get(wanted) ?? null,
        via: mapped === undefined ? "name" : "map",
      };
    }),
  );
};
