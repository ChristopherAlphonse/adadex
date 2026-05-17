import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";
import {
  actionButtonVariants,
  type ActionButtonSize,
  type ActionButtonVariant,
} from "@/lib/ui/action-button";

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
  <button className={cn(actionButtonVariants({ variant, size }), className)} type={type} {...buttonProps}>
    {children}
  </button>
);

export type { ActionButtonVariant, ActionButtonSize } from "@/lib/ui/action-button";
