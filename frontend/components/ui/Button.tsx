import { ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "outline" | "surface" | "ghost-inverse";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Makes the button fully pill-shaped (rounded-full). Default uses rounded-2xl. */
  pill?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-linear-to-br from-primary to-primary-container text-on-primary shadow-lg " +
    "hover:shadow-[0_0_20px_rgba(57,44,193,0.25)]",
  outline:
    "border border-primary/20 bg-surface-container-lowest text-primary " +
    "hover:bg-primary/5",
  surface:
    "bg-surface-container-lowest text-primary hover:bg-surface",
  "ghost-inverse":
    "border border-on-primary/30 text-on-primary hover:bg-white/10",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-6 py-2.5 text-sm",
  md: "px-6 py-3.5 text-sm",
  lg: "px-10 py-4 text-base",
  xl: "px-10 py-5 text-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      pill = false,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const rounded = pill ? "rounded-full" : "rounded-2xl";

    return (
      <button
        ref={ref}
        className={[
          "inline-flex items-center justify-center gap-2",
          "font-headline font-bold transition-all",
          "disabled:pointer-events-none disabled:opacity-50",
          rounded,
          variantClasses[variant],
          sizeClasses[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
