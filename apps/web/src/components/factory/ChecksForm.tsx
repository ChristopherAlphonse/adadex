import { useState } from "react";

export const ChecksForm = ({
  saved,
  isPending,
  onSave,
}: {
  saved: string;
  isPending: boolean;
  onSave: (command: string) => void;
}) => {
  const [draft, setDraft] = useState(saved);

  return (
    <form
      className="flex shrink-0 items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <label className="flex flex-1 flex-col gap-1 text-[12px] text-muted-foreground">
        Checks command (the gate runs this for every job)
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="npm test"
          spellCheck={false}
          className="rounded border border-border bg-surface px-2 py-1.5 font-mono text-[12px] text-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={isPending || draft.trim() === "" || draft === saved}
        className="rounded border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        Save checks
      </button>
    </form>
  );
};
