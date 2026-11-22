import { cn } from "../../lib/utils";

const secondaryButtonClass =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50";

const primaryButtonClass =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

type VaultFileEditorProps = {
  fileName: string;
  value: string;
  error: string | null;
  isSaving: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

export const VaultFileEditor = ({
  fileName,
  value,
  error,
  isSaving,
  onChange,
  onCancel,
  onSave,
}: VaultFileEditorProps) => (
  <div className="flex flex-col gap-3">
    <div className="flex items-baseline justify-between gap-4">
      <p className="text-sm font-medium text-foreground">Editing {fileName}</p>
      <p className="text-xs text-muted-foreground">Saved directly to the coordination file.</p>
    </div>
    <textarea
      aria-label={`Edit ${fileName}`}
      className={cn(
        "max-h-64 min-h-32 w-full resize-y rounded-xl border border-border bg-background p-3",
        "font-mono text-sm leading-relaxed text-foreground outline-none focus:border-primary",
      )}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
      value={value}
    />
    {error ? (
      <output className="text-sm text-destructive" role="alert">
        {error}
      </output>
    ) : null}
    <div className="flex justify-end gap-2">
      <button className={secondaryButtonClass} disabled={isSaving} onClick={onCancel} type="button">
        Cancel
      </button>
      <button className={primaryButtonClass} disabled={isSaving} onClick={onSave} type="button">
        {isSaving ? "Saving…" : "Save"}
      </button>
    </div>
  </div>
);
