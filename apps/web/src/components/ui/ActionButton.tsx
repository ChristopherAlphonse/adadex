import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonVariant = "primary" | "accent" | "info" | "danger";
type ActionButtonSize = "compact" | "dense";

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
}: ActionButtonProps) => {
  const classes = [
    "action-button",
    `action-button--${variant}`,
    `action-button--${size}`,
    className,
  ]
    .filter((value) => Boolean(value))
    .join(" ");

  return (
    <button className={classes} type={type} {...buttonProps}>
      {children}
    </button>
  );
};
