import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  type ActionButtonSize,
  type ActionButtonVariant,
  actionButtonVariants,
} from "@/lib/ui/action-button";
import { cn } from "@/lib/utils";

type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  children: ReactNode;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
};

export const ActionButton = ({
  children,
  className,
  variant = "accent",
  size = "dense",
  type = "button",
  ...buttonProps
}: ActionButtonProps) => (
  <button
    className={cn(actionButtonVariants({ variant, size }), className)}
    type={type}
    {...buttonProps}
  >
    {children}
  </button>
);

export type { ActionButtonSize, ActionButtonVariant } from "@/lib/ui/action-button";
