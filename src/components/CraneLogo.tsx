interface LogoProps {
  className?: string;
  size?: number;
}

export function CraneLogo({ className = '', size = 40 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Truck body base */}
      <rect x="20" y="70" width="50" height="14" rx="2" fill="#1e3a5f" />
      {/* Truck cabin */}
      <path d="M22 70 L22 58 L35 58 L38 70 Z" fill="#1e3a5f" />
      {/* Wheels */}
      <circle cx="32" cy="86" r="6" fill="#1e3a5f" stroke="#f59e0b" strokeWidth="2" />
      <circle cx="32" cy="86" r="2.5" fill="#f59e0b" />
      <circle cx="58" cy="86" r="6" fill="#1e3a5f" stroke="#f59e0b" strokeWidth="2" />
      <circle cx="58" cy="86" r="2.5" fill="#f59e0b" />

      {/* Crane base mount */}
      <rect x="40" y="56" width="10" height="14" rx="1" fill="#f59e0b" />

      {/* Crane boom (angled upward to the right) */}
      <line x1="45" y1="56" x2="85" y2="20" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
      <line x1="45" y1="56" x2="85" y2="20" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" />

      {/* Boom segments (cross braces) */}
      <line x1="52" y1="49" x2="56" y2="45" stroke="#1e3a5f" strokeWidth="1.5" />
      <line x1="60" y1="41" x2="64" y2="37" stroke="#1e3a5f" strokeWidth="1.5" />
      <line x1="68" y1="33" x2="72" y2="29" stroke="#1e3a5f" strokeWidth="1.5" />
      <line x1="76" y1="25" x2="80" y2="21" stroke="#1e3a5f" strokeWidth="1.5" />

      {/* Cable from boom tip */}
      <line x1="85" y1="20" x2="85" y2="38" stroke="#1e3a5f" strokeWidth="1.5" strokeDasharray="2,2" />

      {/* Hook */}
      <path d="M85 38 Q85 42 82 42 Q79 42 79 39" stroke="#f59e0b" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Outrigger stabilizers */}
      <line x1="25" y1="84" x2="18" y2="88" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" />
      <line x1="65" y1="84" x2="72" y2="88" stroke="#1e3a5f" strokeWidth="2" strokeLinecap="round" />

      {/* Ground line */}
      <line x1="10" y1="92" x2="90" y2="92" stroke="#1e3a5f" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}
