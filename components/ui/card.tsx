import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  isPressed?: boolean;
}

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

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <div className={`flex flex-col space-y-1.5 pb-3 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <h3 className={`font-sans font-bold text-lg tracking-normal text-text ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <p className={`font-sans text-xs text-text-muted ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <div className={`pt-0 text-sm ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  children,
  ...props
}) => (
  <div className={`flex items-center pt-3 border-t border-text/5 mt-3 ${className}`} {...props}>
    {children}
  </div>
);
