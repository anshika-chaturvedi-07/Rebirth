export function Cloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} aria-hidden="true">
      <g fill="#fff">
        <circle cx="35" cy="38" r="20" />
        <circle cx="60" cy="28" r="26" />
        <circle cx="88" cy="38" r="19" />
        <rect x="20" y="36" width="84" height="22" rx="11" />
      </g>
    </svg>
  );
}
