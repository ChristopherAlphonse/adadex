import { resolveSkills } from "@adadex/core";
import { type MachineConfig, saveMachineConfig } from "../config/machineConfig";
import type { ActionHost } from "../host/actionHost";
import type { JobStore } from "../jobs/jobStore";
import { createFsSkillCatalog } from "../skills/fsSkillCatalog";
import type { WorkflowStore } from "../workflows/workflowStore";
import type { ApprovalBroker } from "./approvalBroker";
import { type HostResponse, type ProcessPort, parseRequest } from "./contract";

export interface HostApiDeps {
  readonly workflows: WorkflowStore;
  readonly jobs: JobStore;
  readonly host: ActionHost;
  readonly approvals: ApprovalBroker;
  /** Absent until Electron wires a process supervisor; the panels then render empty. */
  readonly processes?: ProcessPort;
  readonly loadConfig: () => Promise<MachineConfig>;
  readonly configPath: string;
  readonly roundLimit: number;
}

const ok = (data: unknown): HostResponse => ({ ok: true, data });
const fail = (...errors: string[]): HostResponse => ({ ok: false, errors });
const message = (e: unknown): string => (e instanceof Error ? e.message : "request failed");

export interface HostApi {
  /** Takes whatever the UI sent. Never throws. */
  handle(raw: unknown): Promise<HostResponse>;
}

/** The one entry point the Electron main process forwards UI requests to. */
export const createHostApi = (deps: HostApiDeps): HostApi => ({
  async handle(raw) {
    const parsed = parseRequest(raw);
    if (!parsed.ok) return fail(parsed.error);
    const req = parsed.request;
    try {
      switch (req.kind) {
        case "workflows.list":
          return ok(await deps.workflows.list());
        case "workflows.save": {
          const r = await deps.workflows.save(req.workflow);
          return r.ok ? ok(r.workflow) : fail(...r.errors);
        }
        case "workflows.fork": {
          const r = await deps.workflows.fork(req.fromId, req.newId, req.name);
          return r.ok ? ok(r.workflow) : fail(...r.errors);
        }
        case "workflows.remove": {
          const r = await deps.workflows.remove(req.id);
          return r.ok ? ok(null) : fail(...r.errors);
        }
        case "jobs.list":
          return ok(await deps.jobs.list());
        case "jobs.create": {
          const def = await deps.workflows.get(req.workflowId);
          if (!def) return fail(`no workflow ${req.workflowId}`);
          return ok(await deps.jobs.create(def, req.id, req.title, deps.roundLimit));
        }
        case "action.run": {
          const r = await deps.host.fromUi(req.actionId, req.input);
          return r.status === "ok"
            ? ok(r.output)
            : fail(
                r.status === "error" ? r.message : r.status === "denied" ? r.reason : "declined",
              );
        }
        case "approval.respond":
          return deps.approvals.respond(req.approvalId, req.approved)
            ? ok(null)
            : fail("no such approval is waiting");
        case "approvals.list":
          return ok(deps.approvals.pending());
        case "processes.list":
          return ok(deps.processes === undefined ? [] : await deps.processes.list());
        case "process.kill":
          if (deps.processes === undefined) return fail("process control is not available");
          await deps.processes.kill(req.processId);
          return ok(null);
        case "skills.resolve": {
          const def = await deps.workflows.get(req.workflowId);
          if (!def) return fail(`no workflow ${req.workflowId}`);
          const config = await deps.loadConfig();
          const available = await createFsSkillCatalog(config.skillSources).list();
          return ok(resolveSkills(def, available, config.skillMap));
        }
        case "config.get":
          return ok(await deps.loadConfig());
        case "config.set": {
          const r = await saveMachineConfig(deps.configPath, req.config);
          return r.ok ? ok(r.config) : fail(...r.errors);
        }
      }
    } catch (e) {
      return fail(message(e));
    }
  },
});
