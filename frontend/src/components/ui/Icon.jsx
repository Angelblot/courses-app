const PATHS = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </>
  ),
  book: (
    <>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z" />
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    </>
  ),
  bag: (
    <>
      <path d="M5 7h14l-1.2 12.1A2 2 0 0 1 15.8 21H8.2a2 2 0 0 1-2-1.9L5 7Z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  car: (
    <>
      <path d="M5 17h14" />
      <path d="M5 17v-4.5l2-4.5h10l2 4.5V17" />
      <circle cx="8" cy="17" r="2" />
      <circle cx="16" cy="17" r="2" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  check: <path d="M5 12.5 10 17.5 20 7" />,
  x: (
    <>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M20 12H4" />
      <path d="M10 6 4 12l6 6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M4 12h16" />
      <path d="M14 6l6 6-6 6" />
    </>
  ),
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="m14 6 4 4" />
    </>
  ),
  star: <path d="M12 3.5l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L2.2 9.9l6.1-.9L12 3.5z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15 20c0-2.8 2-5 4-5" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 21c0-8 6-16 16-16 0 10-6 16-16 16Z" />
      <path d="M5 21c3-6 8-11 14-13" />
    </>
  ),
  fire: <path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-1.5.6-2.7 1.2-3.6A3 3 0 0 1 12 3zm0 14a3 3 0 0 0 3-3c0-1.6-1-3-1-3s0 1-1 1.5c0-2-1-3-1-3s-1 1.2-1 3c0 2-1 2.5-1 2.5s-1 .5-1 2a3 3 0 0 0 3 3z" />,
  chef: (
    <>
      <path d="M6 13a4 4 0 1 1 5-5 4 4 0 0 1 6 0 4 4 0 1 1-2 7v3H8v-3a4 4 0 0 1-2-2z" />
      <path d="M8 20h8" />
    </>
  ),
  bowl: (
    <>
      <path d="M3 11h18c0 5-4 9-9 9s-9-4-9-9Z" />
      <path d="M7 8c0-1.5 1-3 3-3s3 1.5 3 3" />
      <path d="M13 8c0-1.5 1-3 3-3" />
    </>
  ),
  apple: (
    <>
      <path d="M12 7c0-2 2-4 4-4 0 2-2 4-4 4z" />
      <path d="M7 10c2-2 5-2 7 0 2-2 5-2 7 0-.3 6-4 11-7 11s-6.7-5-7-11z" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3v6" />
      <path d="M12 15v6" />
      <path d="M3 12h6" />
      <path d="M15 12h6" />
      <path d="M6 6l3 3" />
      <path d="M15 15l3 3" />
      <path d="M18 6l-3 3" />
      <path d="M9 15l-3 3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v.01" />
      <path d="M11 12h1v5h1" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 10v5" />
      <path d="M12 18v.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  filter: (
    <>
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </>
  ),
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 10a2.5 2.5 0 0 1 5 0c0 1-.7 1.5-1.5 2S12 13 12 14" />
      <path d="M12 17v.01" />
    </>
  ),
  package: (
    <>
      <path d="M3 8l9-5 9 5v8l-9 5-9-5V8z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  cart: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="17" cy="20" r="1.5" />
      <path d="M3 4h2l2.5 12h11l2-8H6" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c-2-3-6-3-8-2 0 4 3 7 8 7" />
      <path d="M12 13c2-3 6-3 8-2 0 4-3 7-8 7" />
    </>
  ),
};

export function Icon({ name, size = 20, strokeWidth = 1.75, className = '', ...rest }) {
  const paths = PATHS[name];
  if (!paths) return null;
  const isSolid = name === 'star' || name === 'heart' || name === 'fire';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isSolid ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={isSolid ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths}
    </svg>
  );
}
