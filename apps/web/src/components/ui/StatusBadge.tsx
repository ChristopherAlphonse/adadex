export type StatusBadgeTone = "live" | "idle" | "processing" | "queued" | "blocked" | "warning";

type StatusBadgeProps = {
  tone: StatusBadgeTone;
  label?: string;
  compactLabel?: string;
  className?: string;
};

export const StatusBadge = ({ tone, label, compactLabel, className }: StatusBadgeProps) => {
  const classes = ["status-badge", "pill", tone, className]
    .filter((value) => Boolean(value))
    .join(" ");
  const fullLabel = label ?? tone.toUpperCase();

  return (
    <span className={classes}>
      <span className="status-badge__full">{fullLabel}</span>
      {compactLabel && compactLabel !== fullLabel ? (
        <span className="status-badge__compact">{compactLabel}</span>
      ) : null}
    </span>
  );
};
