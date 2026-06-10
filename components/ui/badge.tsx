/**
 * Neumorphic Badge Component
 *
 * Renders small status tags, metrics, and labels styled
 * with either recessed (concave) or raised (convex) neumorphic shadows.
 *
 * Responsibilities:
 * - Render inline classification elements.
 * - Supply spacing and semantic coloring values matching the design system.
 */

import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "success" | "danger" | "warning";
  type?: "raised" | "recessed";
}

/**
 * Small badge tag for categorization and status display.
 *
 * @param props Badge configurations including variant and shadow type
 * @returns React span element
 */
export const Badge: React.FC<BadgeProps> = ({
  className = "",
  variant = "default",
  type = "recessed",
  children,
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-text/5";

  const shadowStyles = {
    raised: "shadow-extruded",
    recessed: "shadow-recessed",
  };

  const variantStyles = {
    default: "text-text-muted bg-surface/50",
    primary: "text-primary bg-primary/5",
    success: "text-success bg-success/5",
    danger: "text-danger bg-danger/5",
    warning: "text-warning bg-warning/5",
  };

  return (
    <span
      className={`
        ${baseStyles}
        ${shadowStyles[type]}
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
};
