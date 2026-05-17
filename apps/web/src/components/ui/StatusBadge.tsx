import { type StatusBadgeTone, statusBadgeVariants } from "@/lib/ui/status-badge";
import { cn } from "@/lib/utils";

export type { StatusBadgeTone } from "@/lib/ui/status-badge";

type StatusBadgeProps = {
  tone: StatusBadgeTone;
  label?: string;
  compactLabel?: string;
  className?: string;
};

export const StatusBadge = ({ tone, label, compactLabel, className }: StatusBadgeProps) => {
  const fullLabel = label ?? tone.toUpperCase();

  return (
    <span className={cn(statusBadgeVariants({ tone }), className)}>
      <span className="status-badge__full">{fullLabel}</span>
      {compactLabel && compactLabel !== fullLabel ? (
        <span className="status-badge__compact">{compactLabel}</span>
      ) : null}
    </span>
  );
};
