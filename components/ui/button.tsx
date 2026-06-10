import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "success" | "danger" | "warning" | "default";
  size?: "sm" | "md" | "lg";
  isPressed?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      variant = "default",
      size = "md",
      isPressed = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    // Neumorphic style foundations
    const baseStyle =
      "font-sans font-bold uppercase tracking-wider rounded-lg transition-all duration-150 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 flex items-center justify-center gap-2 border cursor-pointer select-none";

    const sizeStyles = {
      sm: "text-xs py-1.5 px-3",
      md: "text-sm py-2 px-5",
      lg: "text-base py-3 px-7",
    };

    const variantStyles = {
      default:
        "bg-surface text-text border-text/10 shadow-extruded hover:shadow-extruded-hover active:shadow-recessed active:translate-y-[1px]",
      primary:
        "bg-surface text-primary border-primary/20 shadow-extruded hover:shadow-extruded-hover active:shadow-recessed active:translate-y-[1px] hover:text-[#004D4D]",
      success:
        "bg-surface text-success border-success/20 shadow-extruded hover:shadow-extruded-hover active:shadow-recessed active:translate-y-[1px] hover:text-[#00802F]",
      danger:
        "bg-surface text-danger border-danger/20 shadow-extruded hover:shadow-extruded-hover active:shadow-recessed active:translate-y-[1px] hover:text-[#D01A46]",
      warning:
        "bg-surface text-warning border-warning/20 shadow-extruded hover:shadow-extruded-hover active:shadow-recessed active:translate-y-[1px] hover:text-[#D48000]",
    };

    const disabledStyles =
      "bg-surface text-text-muted/40 border-text/5 cursor-not-allowed shadow-none! translate-y-0! pointer-events-none";

    const pressedStyle = "shadow-recessed translate-y-[1px]";

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`
          ${baseStyle}
          ${sizeStyles[size]}
          ${disabled ? disabledStyles : variantStyles[variant]}
          ${isPressed && !disabled ? pressedStyle : ""}
          ${className}
        `}
        {...props}
      >
        {leftIcon && <span className="flex items-center justify-center">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="flex items-center justify-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
