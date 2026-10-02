import type { SVGProps } from 'react';

const paths = {
  // Tool icons share one 24px grid, rounded joins and optical weight; small filled accents mark what each tool leaves behind.
  select: 'M6.2 3.8v14.4l3.9-3.7 2.6 5.8 2.5-1.1-2.6-5.7h5.5z',
  arrow: 'M5.5 18.5L17.5 6.5M10 6h8v8',
  line: 'M5.5 18.5L18.5 5.5',
  crop: 'M7.5 3.5v13h13M3.5 7.5h13v13',
  rectangle: 'M4.5 7a2.5 2.5 0 012.5-2.5h10A2.5 2.5 0 0119.5 7v10a2.5 2.5 0 01-2.5 2.5H7A2.5 2.5 0 014.5 17z',
  ellipse: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z',
  pen: 'M4.5 19.5l1-4.2L15.6 5.2a2 2 0 012.8 0l.4.4a2 2 0 010 2.8L8.7 18.5zM13.8 7l3.2 3.2',
  highlight: 'M9.5 16.5l-3-3 8.3-8.3a2 2 0 012.8 0l.2.2a2 2 0 010 2.8zM6.5 13.5L4 19l5.5-2.5M13 20h7',
  text: 'M5.5 7.5V5h13v2.5M12 5v14M9.5 19h5',
  step: 'M12 3.8a8.2 8.2 0 110 16.4 8.2 8.2 0 010-16.4zM10.6 9.6L12.6 8v8.2',
  pixelate: 'M4.5 7A2.5 2.5 0 017 4.5h10A2.5 2.5 0 0119.5 7v10a2.5 2.5 0 01-2.5 2.5H7A2.5 2.5 0 014.5 17z',
  github: 'M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 00-1.3-3.2 4.2 4.2 0 00-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 00-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 00-.1 3.2A4.6 4.6 0 004 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21',
  linkedin: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-4 0v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 2.5a2 2 0 110 4 2 2 0 010-4z',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3',
  zoomIn: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4M11 8v6M8 11h6',
  zoomOut: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4M8 11h6',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  save: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5a1.5 1.5 0 100-.01',
  paste: 'M9 4h6v3H9zM7 5H5v15h14V5h-2',
  history: 'M4 12a8 8 0 102.3-5.7M4 4v4h4M12 8v4l3 2',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  check: 'M5 12l5 5L20 7',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.8a2.8 2.8 0 100-5.6 2.8 2.8 0 000 5.6z',
  close: 'M6 6l12 12M18 6L6 18',
  minus: 'M5 12h14',
  maximize: 'M6 6h12v12H6z',
  refresh: 'M20 11a8 8 0 00-14.6-4.5M4 4v4h4M4 13a8 8 0 0014.6 4.5M20 20v-4h-4',
  alert: 'M12 8v5M12 16.5v.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5M8.5 9h7M8.5 12.5h4',
  panel: 'M4 5h16v14H4zM14.5 5v14',
  terminal: 'M5.5 4.5h13a2 2 0 012 2v11a2 2 0 01-2 2h-13a2 2 0 01-2-2v-11a2 2 0 012-2zM7.5 9.5l3 2.5-3 2.5M13 14.5h3.5',
} as const;
export type IconName = keyof typeof paths;
/** Filled details layered on top of the outline. */
const fills: Partial<Record<IconName, string>> = {
  select: 'M6.2 3.8v14.4l3.9-3.7 2.6 5.8 2.5-1.1-2.6-5.7h5.5z',
  arrow: 'M18 6l-.1 8.1-8-8z',
  highlight: 'M6.5 13.5L4 19l5.5-2.5z',
  pixelate: 'M8 8h2.7v2.7H8zM13.3 8H16v2.7h-2.7zM10.7 10.7h2.6v2.6h-2.6zM8 13.3h2.7V16H8zM13.3 13.3H16V16h-2.7z',
};

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  const fill = fills[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d={paths[name]} />
      {fill && <path d={fill} fill="currentColor" stroke="none" opacity={name === 'select' ? 0.18 : 1} />}
    </svg>
  );
}
/** Line-only Snipflag mark that follows the surrounding text color, for surfaces where the black tile is too heavy. */
export function Mark({ size = 18, className = 'brand-mark' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="96 96 320 320" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round">
      <path d="M204 135h-69v69m173 173h69v-69M135 308v69h69" />
      <path className="brand-arrow" d="M235 277l139-139m-89 0h89v89" />
    </svg>
  );
}
