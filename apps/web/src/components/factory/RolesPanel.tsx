import { asRecord, type ParsedRecord } from "@adadex/core";
import { useState } from "react";

import type { FactoryRole } from "../../runtime/factoryHost";

type RoleDraft = ParsedRecord;

type RolesPanelProps = {
  roles: readonly FactoryRole[];
  pendingKey: string | null;
  onSave: (role: RoleDraft) => Promise<boolean>;
  onRemove: (id: string) => void;
};

export const RolesPanel = ({ roles, pendingKey, onSave, onRemove }: RolesPanelProps) => {
  const [draft, setDraft] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const edit = (role: FactoryRole) => {
    const definition =
      role.origin === "preset"
        ? { ...role.definition, id: `${role.id}-copy`, name: `${role.name} (copy)`, origin: "user" }
        : role.definition;

    setDraft(JSON.stringify(definition, null, 2));
    setParseError(null);
  };

  const save = async () => {
    let parsed: unknown;

    try {
      parsed = JSON.parse(draft);
    } catch {
      setParseError("The role is not valid JSON.");

      return;
    }

    const role = asRecord(parsed);

    if (role === null) {
      setParseError("The role must be a JSON object.");

      return;
    }

    setParseError(null);

    if (await onSave(role)) setDraft("");
  };

  return (
    <section aria-label="Roles" className="rounded-lg border border-border bg-surface p-3">
      <h2 className="mb-2 text-[14px] font-semibold text-foreground">
        Roles
        <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">
          {roles.length}
        </span>
      </h2>
      <ul className="space-y-2">
        {roles.map((role) => (
          <li
            key={role.id}
            className="flex items-center justify-between gap-2 rounded border border-border bg-surface-2 px-2 py-1.5"
          >
            <div className="min-w-0">
              <p className="truncate text-[12px] text-foreground">{role.name}</p>
              <p className="font-mono text-[11px] text-muted-foreground">
                {role.id} · {role.origin}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                aria-label={`${role.origin === "preset" ? "Copy" : "Edit"} role ${role.name}`}
                onClick={() => edit(role)}
                className="rounded border border-border bg-background px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
              >
                {role.origin === "preset" ? "Copy" : "Edit"}
              </button>
              {role.origin === "user" && (
                <button
                  type="button"
                  aria-label={`Remove role ${role.name}`}
                  disabled={pendingKey === `role:remove:${role.id}`}
                  onClick={() => onRemove(role.id)}
                  className="rounded border border-destructive/60 bg-destructive/10 px-2 py-1 text-[12px] font-medium text-foreground hover:bg-destructive/20 disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
          Role JSON (copy a preset to start)
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={8}
            spellCheck={false}
            className="rounded border border-border bg-surface-2 px-2 py-1.5 font-mono text-[12px] text-foreground"
          />
        </label>
        {parseError !== null && (
          <p role="alert" className="text-[12px] text-destructive">
            {parseError}
          </p>
        )}
        <button
          type="submit"
          disabled={draft.trim() === "" || pendingKey === "role:save"}
          className="self-start rounded border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Save role
        </button>
      </form>
    </section>
  );
};
