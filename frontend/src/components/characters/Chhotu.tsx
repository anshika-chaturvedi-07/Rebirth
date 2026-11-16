/** Chhotu — REBIRTH's mascot, an Indian street dog. Wags his tail and blinks. */
export function Chhotu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 170 150" className={className} role="img" aria-label="Chhotu the dog">
      <g className="char-tail" style={{ transformOrigin: "128px 112px" }}>
        <path d="M126 114 C152 108 160 84 150 72" stroke="#D9934F" strokeWidth="13" fill="none" strokeLinecap="round" />
      </g>
      <ellipse cx="94" cy="122" rx="46" ry="28" fill="#D9934F" />
      <ellipse cx="94" cy="122" rx="46" ry="28" fill="url(#clay-glow)" />
      <path d="M40 46 C14 44 12 96 32 104 C44 92 50 70 54 58Z" fill="#A8642F" />
      <path d="M120 46 C146 44 148 96 128 104 C116 92 110 70 106 58Z" fill="#A8642F" />
      <ellipse cx="80" cy="74" rx="46" ry="42" fill="#D9934F" />
      <path d="M80 34 C72 56 58 78 60 96 C68 114 92 114 100 96 C102 78 88 56 80 34Z" fill="#FFF4E6" />
      <ellipse cx="80" cy="98" rx="27" ry="19" fill="#FFF4E6" />
      <ellipse cx="80" cy="74" rx="46" ry="42" fill="url(#clay-glow)" />
      <g className="char-eyes">
        <ellipse cx="62" cy="74" rx="7" ry="8.5" fill="#2E1F3E" />
        <ellipse cx="98" cy="74" rx="7" ry="8.5" fill="#2E1F3E" />
        <circle cx="64.5" cy="71" r="2.5" fill="#fff" />
        <circle cx="100.5" cy="71" r="2.5" fill="#fff" />
      </g>
      <ellipse cx="80" cy="90" rx="9" ry="6.5" fill="#2E1F3E" />
      <path d="M70 100 Q80 108 90 100" stroke="#2E1F3E" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M74 103 C74 118 86 118 86 103Z" fill="#FF7E93" />
      <ellipse cx="50" cy="90" rx="7" ry="4.5" fill="#FF9AAA" opacity=".55" />
      <ellipse cx="110" cy="90" rx="7" ry="4.5" fill="#FF9AAA" opacity=".55" />
      <ellipse cx="64" cy="144" rx="15" ry="9" fill="#FFF4E6" />
      <ellipse cx="104" cy="144" rx="15" ry="9" fill="#FFF4E6" />
    </svg>
  );
}
