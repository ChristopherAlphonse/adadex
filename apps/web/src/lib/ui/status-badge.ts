import { cva, type VariantProps } from "class-variance-authority";

export const statusBadgeVariants = cva("status-badge pill", {
  variants: {
    tone: {
      live: "live",
      idle: "idle",
      processing: "processing",
      queued: "queued",
      blocked: "blocked",
      warning: "warning",
    },
  },
});

export type StatusBadgeTone = NonNullable<VariantProps<typeof statusBadgeVariants>["tone"]>;
