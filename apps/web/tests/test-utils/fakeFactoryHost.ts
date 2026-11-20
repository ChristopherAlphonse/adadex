import { vi } from "vitest";

import type { FactoryHost } from "../../src/runtime/factoryHost";

export const createFakeFactoryHost = (overrides: Partial<FactoryHost> = {}): FactoryHost => {
  const host: FactoryHost = {
    isAvailable: vi.fn(() => true),
    listJobs: vi.fn(async () => []),
    listWorkflows: vi.fn(async () => []),
    listApprovals: vi.fn(async () => []),
    listProcesses: vi.fn(async () => []),
    runAction: vi.fn(async () => undefined),
    respondApproval: vi.fn(async () => undefined),
    killProcess: vi.fn(async () => undefined),
    getLoop: vi.fn(async () => null),
    setLoop: vi.fn(async () => undefined),
    getChecks: vi.fn(async () => null),
    setChecks: vi.fn(async () => undefined),
    listRoles: vi.fn(async () => null),
    saveRole: vi.fn(async () => undefined),
    removeRole: vi.fn(async () => undefined),
    listLogs: vi.fn(async () => null),
    verifyAudit: vi.fn(async () => ({ ok: true as const, entries: 0 })),
    subscribe: vi.fn(() => () => undefined),
  };

  return Object.assign(host, overrides);
};
