import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const lightenColor = (color: string, factor: number): string => {
  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Lighten
  const lightenChannel = (channel: number) => 
    Math.round(channel + (255 - channel) * factor);

  const rLight = lightenChannel(r);
  const gLight = lightenChannel(g);
  const bLight = lightenChannel(b);

  // Convert back to hex
  return `#${[rLight, gLight, bLight]
    .map(c => c.toString(16).padStart(2, '0'))
    .join('')}`;
};
