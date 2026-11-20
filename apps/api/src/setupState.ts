import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { asRecord, isString, type ParsedRecord } from "@adadex/core";
import type { WorkspaceSetupStepId } from "@adadex/core";

const SETUP_STATE_RELATIVE_PATH = join("state", "setup.json");

const VERIFIED_SETUP_STEP_IDS = ["check-kiro", "check-git", "check-curl"] as const;

type VerifiedSetupStepId = (typeof VERIFIED_SETUP_STEP_IDS)[number];

export type SetupState = {
  version: 1;
  coordinationsInitializedAt?: string;
  verifiedSteps?: Partial<Record<VerifiedSetupStepId, string>>;
};

const isVerifiedSetupStepId = (value: WorkspaceSetupStepId): value is VerifiedSetupStepId =>
  VERIFIED_SETUP_STEP_IDS.includes(/* SAFETY: preceding checks establish the invariant this assertion encodes. */ value as VerifiedSetupStepId);

export const readSetupState = (stateDir: string): SetupState => {
  const filePath = join(stateDir, SETUP_STATE_RELATIVE_PATH);

  if (!existsSync(filePath)) {
    return { version: 1 };
  }

  try {
    const raw: ParsedRecord = asRecord(JSON.parse(readFileSync(filePath, "utf-8"))) ?? {};
    const verifiedSteps: Partial<Record<VerifiedSetupStepId, string>> = {};
    const verifiedStepRecords = asRecord(raw.verifiedSteps);

    if (verifiedStepRecords) {
      for (const stepId of VERIFIED_SETUP_STEP_IDS) {
        const checkedAt = verifiedStepRecords[stepId];

        if (isString(checkedAt)) {
          verifiedSteps[stepId] = checkedAt;
        }
      }
    }

    const coordinationsInitializedAt =
      isString(raw.coordinationsInitializedAt)
        ? raw.coordinationsInitializedAt
        : isString(raw.orchestrationsInitializedAt)
          ? raw.orchestrationsInitializedAt
          : undefined;

    const result: SetupState = { version: 1 };

    if (coordinationsInitializedAt) {
      result.coordinationsInitializedAt = coordinationsInitializedAt;
    }

    if (Object.keys(verifiedSteps).length > 0) {
      result.verifiedSteps = verifiedSteps;
    }

    return result;
  } catch {
    return { version: 1 };
  }
};

export const writeSetupState = (stateDir: string, state: SetupState) => {
  mkdirSync(join(stateDir, "state"), { recursive: true });
  writeFileSync(join(stateDir, SETUP_STATE_RELATIVE_PATH), `${JSON.stringify(state, null, 2)}\n`);
};

export const markSetupStepVerified = (stateDir: string, stepId: WorkspaceSetupStepId) => {
  if (!isVerifiedSetupStepId(stepId)) {
    return;
  }

  const currentState = readSetupState(stateDir);
  writeSetupState(stateDir, {
    ...currentState,
    verifiedSteps: {
      ...currentState.verifiedSteps,
      [stepId]: new Date().toISOString(),
    },
  });
};

export const markCoordinationsInitialized = (stateDir: string) => {
  const currentState = readSetupState(stateDir);

  if (currentState.coordinationsInitializedAt) {
    return;
  }

  writeSetupState(stateDir, {
    ...currentState,
    coordinationsInitializedAt: new Date().toISOString(),
  });
};
