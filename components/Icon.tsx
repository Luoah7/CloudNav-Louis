import React from 'react';
import iconMap from './iconMap';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

const Icon: React.FC<IconProps> = ({ name, size = 20, className }) => {
  const IconComponent = iconMap[name] || iconMap.Link;
  return <IconComponent size={size} className={className} />;
};

export default Icon;
