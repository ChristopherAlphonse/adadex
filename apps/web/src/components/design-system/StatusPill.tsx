import { statusToken } from "./statusColor";
import type { AgentStatus } from "./types";

type StatusPillProps = {
  status: AgentStatus;
};

export const StatusPill = ({ status }: StatusPillProps) => {
  const token = statusToken(status);

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12.5px] font-semibold uppercase tracking-wide"
      style={{
        borderColor: `oklch(from var(--${token}) l c h / 0.35)`,
        backgroundColor: `oklch(from var(--${token}) l c h / 0.12)`,
        color: `var(--${token})`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: `var(--${token})` }} />
      {status}
    </span>
  );
};
