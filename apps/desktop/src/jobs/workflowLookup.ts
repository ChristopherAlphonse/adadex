import { isFunctionValue } from "@adadex/core";
import type { WorkflowDefinition } from "@adadex/core";

/** Workflows by id: a fixed table, or a function for workflows that can be added while the app runs. */
export type WorkflowLookup =
  | Readonly<Record<string, WorkflowDefinition>>
  | ((id: string) => WorkflowDefinition | undefined | Promise<WorkflowDefinition | undefined>);

export const findWorkflow = async (
  lookup: WorkflowLookup,
  id: string,
): Promise<WorkflowDefinition> => {
  const def = isFunctionValue(lookup) ? await lookup(id) : lookup[id];

  if (!def) throw new Error(`unknown workflow ${id}`);

  return def;
};
