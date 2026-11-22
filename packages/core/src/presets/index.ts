import type { WorkflowDefinition } from "../domain/workflow";
import { factoryBuildPreset } from "./factoryBuild";
import { factoryReviewPreset } from "./factoryReview";

export { factoryBuildPreset, factoryReviewPreset };

/** The two workflows that ship with the app. */
export const PRESET_WORKFLOWS: readonly WorkflowDefinition[] = [
  factoryBuildPreset,
  factoryReviewPreset,
];
