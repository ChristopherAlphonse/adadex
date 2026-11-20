import type { ApprovalGate } from "@adadex/core";

export interface PendingApproval {
  readonly approvalId: string;
  readonly actionId: string;
  readonly reason: string;
}

export interface ApprovalBroker {
  /** The gate an agent's `ask` actions wait on. */
  readonly gate: ApprovalGate;
  pending(): readonly PendingApproval[];
  /** Resolves a waiting request. Returns false for an id that is not waiting (already answered, or never existed). */
  respond(approvalId: string, approved: boolean): boolean;
  /** Decline everything still waiting, for example when the app quits. */
  declineAll(): void;
}

/** Holds agent approval requests until a person answers them in the UI. */
export const createApprovalBroker = (onRequested: (p: PendingApproval) => void): ApprovalBroker => {
  const waiting = new Map<string, { info: PendingApproval; resolve: (ok: boolean) => void }>();
  let counter = 0;
  return {
    gate: {
      request: (actionId, reason) =>
        new Promise((resolve) => {
          const approvalId = `approval-${++counter}`;
          const info = { approvalId, actionId, reason };
          waiting.set(approvalId, { info, resolve });
          onRequested(info);
        }),
    },
    pending: () => [...waiting.values()].map((w) => w.info),
    respond(approvalId, approved) {
      const entry = waiting.get(approvalId);
      if (!entry) return false;
      waiting.delete(approvalId);
      entry.resolve(approved);
      return true;
    },
    declineAll() {
      for (const [id, entry] of waiting) {
        waiting.delete(id);
        entry.resolve(false);
      }
    },
  };
};
