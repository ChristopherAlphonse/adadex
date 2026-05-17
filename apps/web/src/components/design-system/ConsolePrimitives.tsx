import type { ReactNode } from "react";

const Box = "div";

export const Meter = ({
  label,
  value,
  muted,
}: {
  label: string;
  value: number;
  muted?: boolean;
}): React.ReactElement => (
  <Box className="flex items-center gap-2">
    <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
    <Box className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
      <Box
        className={`h-full ${muted ? "bg-muted-foreground" : "bg-brand"}`}
        style={{ width: `${value}%` }}
      />
    </Box>
    <span className="font-mono text-[13px] font-medium text-foreground">{value}%</span>
  </Box>
);

export const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): React.ReactElement => (
  <section className="border-b border-border p-5">
    <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {title}
    </p>
    {children}
  </section>
);

export const KV = ({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): React.ReactElement => (
  <Box className="flex items-center justify-between py-1 text-[14.5px]">
    <span className="text-muted-foreground">{label}</span>
    <span className={mono ? "font-mono text-foreground" : "text-foreground"}>{value}</span>
  </Box>
);

export const Bar = ({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix: string;
}): React.ReactElement => (
  <Box>
    <Box className="mb-1.5 flex items-center justify-between text-[14.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-foreground">{suffix}</span>
    </Box>
    <Box className="h-1.5 w-full overflow-hidden rounded-full bg-border">
      <Box className="h-full bg-brand transition-all" style={{ width: `${Math.max(2, value)}%` }} />
    </Box>
  </Box>
);
