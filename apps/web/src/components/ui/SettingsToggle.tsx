import { cn } from "@/lib/utils";

type SettingsToggleProps = {
  label: string;
  description: string;
  ariaLabel: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export const SettingsToggle = ({
  label,
  description,
  ariaLabel,
  checked,
  onChange,
}: SettingsToggleProps) => (
  <button
    aria-checked={checked}
    aria-label={ariaLabel}
    className={cn(
      "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border p-3 text-left transition-colors",
      "focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-ring",
      checked ? "border-running/60 bg-running/15" : "border-border bg-surface text-foreground",
    )}
    onClick={() => onChange(!checked)}
    role="switch"
    type="button"
  >
    <span className="grid content-start gap-1">
      <span className="text-[0.8rem] tracking-wide text-foreground">{label}</span>
      <span className="text-[0.73rem] leading-snug text-muted-foreground">{description}</span>
    </span>
    <span
      aria-hidden="true"
      className={cn(
        "relative h-[1.22rem] w-[2.35rem] rounded-full border transition-colors",
        checked ? "border-running/60 bg-running/35" : "border-border bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-1/2 left-0.5 size-[0.9rem] -translate-y-1/2 rounded-full bg-foreground transition-transform",
          checked && "translate-x-[1.08rem] bg-primary-foreground",
        )}
      />
    </span>
    <span
      className={cn(
        "font-mono text-[0.75rem] tracking-wide uppercase",
        checked ? "text-primary" : "text-muted-foreground",
      )}
    >
      {checked ? "Enabled" : "Disabled"}
    </span>
  </button>
);
