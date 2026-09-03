import React from 'react';

interface GoogleIconProps {
  name: string;
  className?: string;
  fill?: boolean;
}

export const GoogleIcon: React.FC<GoogleIconProps> = ({
  name,
  className = '',
  fill = false,
}) => {
  return (
    <span
      className={`material-symbols-rounded select-none inline-flex items-center justify-center leading-none text-current ${className}`}
      style={
        fill
          ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
          : { fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24" }
      }
      aria-hidden="true"
    >
      {name}
    </span>
  );
};
