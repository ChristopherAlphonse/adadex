import { asRecord, asString, isSafeAgentFlagValue } from "@adadex/core";

export const AGENT_LAUNCH_OPTIONS_STORAGE_KEY = "adadex.agentLaunchOptions";

/** Effort levels `claude --effort` accepts. An empty value means the agent's own default. */
export const EFFORT_OPTIONS = ["", "low", "medium", "high", "xhigh", "max"] as const;

export type AgentLaunchSettings = { model: string; effort: string };

const EMPTY: AgentLaunchSettings = { model: "", effort: "" };

export const readAgentLaunchSettings = (): AgentLaunchSettings => {
  try {
    const stored = window.localStorage.getItem(AGENT_LAUNCH_OPTIONS_STORAGE_KEY);
    const record = stored ? asRecord(JSON.parse(stored)) : null;
    const model = asString(record?.model) ?? "";
    const effort = asString(record?.effort) ?? "";

    return {
      model: isSafeAgentFlagValue(model) ? model : "",
      effort: isSafeAgentFlagValue(effort) ? effort : "",
    };
  } catch {
    return EMPTY;
  }
};

export const writeAgentLaunchSettings = (settings: AgentLaunchSettings): void => {
  try {
    window.localStorage.setItem(AGENT_LAUNCH_OPTIONS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
};

export type AgentLaunchRequestFields = { agentModel?: string; agentEffort?: string };

/** The request fields for the saved model and effort. Empty or unsafe values are left out. */
export const launchSettingsToRequest = (
  settings: AgentLaunchSettings,
): AgentLaunchRequestFields => {
  const fields: AgentLaunchRequestFields = {};

  if (isSafeAgentFlagValue(settings.model)) {
    fields.agentModel = settings.model;
  }

  if (isSafeAgentFlagValue(settings.effort)) {
    fields.agentEffort = settings.effort;
  }

  return fields;
};
