import { cva, type VariantProps } from "class-variance-authority";

export const actionButtonVariants = cva("action-button", {
  variants: {
    variant: {
      primary: "action-button--primary",
      accent: "action-button--accent",
      info: "action-button--info",
      danger: "action-button--danger",
    },
    size: {
      dense: "action-button--dense",
      compact: "action-button--compact",
    },
  },
  defaultVariants: {
    variant: "accent",
    size: "dense",
  },
});

export type ActionButtonVariant = NonNullable<VariantProps<typeof actionButtonVariants>["variant"]>;
export type ActionButtonSize = NonNullable<VariantProps<typeof actionButtonVariants>["size"]>;
