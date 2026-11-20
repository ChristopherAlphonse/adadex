import { isFunctionValue } from "@adadex/core";
import type { WorkflowDefinition } from "@adadex/core";

/** A function that resolves a workflow by id, possibly asynchronously. */
type WorkflowResolver = (
  id: string,
) => WorkflowDefinition | undefined | Promise<WorkflowDefinition | undefined>;

/** Workflows by id: a fixed table, or a function for workflows that can be added while the app runs. */
export type WorkflowLookup = Readonly<Record<string, WorkflowDefinition>> | WorkflowResolver;

const isResolver = (lookup: WorkflowLookup): lookup is WorkflowResolver => isFunctionValue(lookup);

export const findWorkflow = async (
  lookup: WorkflowLookup,
  id: string,
): Promise<WorkflowDefinition> => {
  const def = isResolver(lookup) ? await lookup(id) : lookup[id];

  if (!def) throw new Error(`unknown workflow ${id}`);

  return def;
};
