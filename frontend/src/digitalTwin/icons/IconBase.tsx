import React from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  title?: string;
}

export const IconBase: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 20,
  strokeWidth = 2,
  className = '',
  title,
  children,
  ...props
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`shrink-0 ${className}`}
    aria-hidden={!title}
    {...props}
  >
    {title ? <title>{title}</title> : null}
    {children}
  </svg>
);
