/**
 * Neumorphic Card Component Family
 *
 * Implements sub-surfaces for layouts including headers, titles,
 * descriptions, body contents, and footers.
 *
 * Responsibilities:
 * - Render structured visual groupings with extruded/recessed neumorphic shadows.
 * - Supply spacing and styling defaults matching the design system.
 */

import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  isPressed?: boolean;
}

/**
 * Main Card Container element with Neumorphic projection.
 *
 * @param props Card styling configuration including projection direction and hover
 * @returns React div element
 */
export const Card: React.FC<CardProps> = ({
  className = "",
  hoverEffect = false,
  isPressed = false,
  children,
  ...props
}) => {
  return (
    <div
      className={`
        bg-surface rounded-xl p-4 border border-text/5
        ${isPressed ? "shadow-recessed" : "shadow-extruded"}
        ${hoverEffect && !isPressed ? "shadow-extruded-hover" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * Card Header area for grouping title and subtitle labels.
 *
 * @param props HTML element attributes
 * @returns React div element
 */
export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <div className={`flex flex-col space-y-1.5 pb-3 ${className}`} {...props}>
    {children}
  </div>
);

/**
 * Card Title headline.
 *
 * @param props HTML element attributes
 * @returns React h3 element
 */
export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <h3 className={`font-sans font-bold text-lg tracking-normal text-text ${className}`} {...props}>
    {children}
  </h3>
);

/**
 * Supporting description block text.
 *
 * @param props HTML element attributes
 * @returns React paragraph element
 */
export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <p className={`font-sans text-xs text-text-muted ${className}`} {...props}>
    {children}
  </p>
);

/**
 * Card Content body container.
 *
 * @param props HTML element attributes
 * @returns React div element
 */
export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <div className={`pt-0 text-sm ${className}`} {...props}>
    {children}
  </div>
);

/**
 * Card Footer action/metadata container.
 *
 * @param props HTML element attributes
 * @returns React div element
 */
export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <div className={`flex items-center pt-3 border-t border-text/5 mt-3 ${className}`} {...props}>
    {children}
  </div>
);
