import { CAST, type CharacterId, type CharacterLook } from "./cast";

/** Darken (negative) or lighten (positive) a hex colour. */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return "#" + [c(n >> 16), c((n >> 8) & 255), c(n & 255)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

const TORSO = "M38 232 C38 168 66 150 100 150 C134 150 162 168 162 232Z";
const HEAD = { cx: 100, cy: 98, rx: 47, ry: 50 };

function Hair({ look }: { look: CharacterLook }) {
  const h = look.hair;
  switch (look.style) {
    case "short":
      return <path d="M52 96 C46 52 78 40 100 40 C126 40 156 52 148 96 C142 74 124 64 100 66 C80 64 60 74 52 96Z" fill={h} />;
    case "messy":
      return (
        <g fill={h}>
          <path d="M50 100 C44 52 78 38 100 38 C128 38 158 52 150 100 C144 76 124 64 100 66 C80 64 58 76 50 100Z" />
          <path d="M62 60 Q70 26 92 44 Q102 18 118 42 Q140 26 140 62 Q120 52 100 56 Q80 50 62 60Z" />
          <path d="M88 60 Q96 76 84 86" stroke={h} strokeWidth="9" strokeLinecap="round" fill="none" />
        </g>
      );
    case "bun":
      return <path d="M52 100 C48 54 76 44 100 44 C124 44 152 54 148 100 C142 74 120 62 100 66 C80 62 58 74 52 100Z" fill={h} />;
    case "curly":
      return (
        <g fill={h}>
          {Array.from({ length: 11 }, (_, i) => {
            const a = Math.PI * (1.05 + i * 0.09);
            return <circle key={i} cx={100 + Math.cos(a) * 46} cy={92 + Math.sin(a) * 50} r="15" />;
          })}
          <ellipse cx="100" cy="52" rx="40" ry="16" />
        </g>
      );
    default:
      return null;
  }
}

interface CharacterProps {
  id: CharacterId;
  wave?: boolean;
  className?: string;
  title?: string;
}

/** Clay-style cartoon bust drawn entirely in SVG. Blinks by default; can wave. */
export function Character({ id, wave = false, className, title }: CharacterProps) {
  const member = CAST[id];
  const look = member.look;
  const s = look.skin;
  const sd = shade(s, -22);

  return (
    <svg viewBox="-6 0 212 232" className={className} role="img" aria-label={title ?? member.name}>
      {/* behind the head */}
      {look.scarf && <ellipse cx="100" cy="98" rx="60" ry="64" fill={look.scarf} />}
      {look.style === "bun" && (
        <g>
          <circle cx="100" cy="40" r="21" fill={look.hair} />
          <circle cx="100" cy="40" r="21" fill="url(#clay-glow)" />
        </g>
      )}
      {look.hood && <path d="M54 172 C52 140 148 140 146 172Z" fill={shade(look.shirt, -30)} />}

      {/* torso */}
      <path d={TORSO} fill={look.shirt} />
      <path d={TORSO} fill="url(#clay-glow)" />
      <path d={TORSO} fill="url(#clay-shade)" />

      {look.wheelchair && (
        <g className="char-wheel">
          <circle cx="160" cy="196" r="34" fill="none" stroke="#2F9C8F" strokeWidth="9" />
          <g stroke="#2F9C8F" strokeWidth="3">
            <line x1="160" y1="164" x2="160" y2="228" />
            <line x1="128" y1="196" x2="192" y2="196" />
            <line x1="137" y1="173" x2="183" y2="219" />
            <line x1="183" y1="173" x2="137" y2="219" />
          </g>
          <circle cx="160" cy="196" r="7" fill="#FFD66B" />
        </g>
      )}

      {/* neck, ears, head */}
      <rect x="88" y="128" width="24" height="28" rx="10" fill={sd} />
      {!look.scarf && (
        <>
          <circle cx="53" cy="102" r="11" fill={sd} />
          <circle cx="147" cy="102" r="11" fill={sd} />
        </>
      )}
      <ellipse {...HEAD} fill={s} />
      <ellipse {...HEAD} fill="url(#clay-shade)" />
      <ellipse {...HEAD} fill="url(#clay-glow)" />

      {/* face */}
      <ellipse cx="74" cy="116" rx="9" ry="6" fill="#FF7E93" opacity=".45" />
      <ellipse cx="126" cy="116" rx="9" ry="6" fill="#FF7E93" opacity=".45" />
      <g className="char-eyes">
        <ellipse cx="82" cy="100" rx="6.5" ry="8.5" fill="#2E1F3E" />
        <ellipse cx="118" cy="100" rx="6.5" ry="8.5" fill="#2E1F3E" />
        <circle cx="84.5" cy="96.5" r="2.4" fill="#fff" />
        <circle cx="120.5" cy="96.5" r="2.4" fill="#fff" />
      </g>
      <ellipse cx="100" cy="110" rx="4" ry="3" fill={sd} />
      <path d="M88 121 Q100 133 112 121" stroke="#7A2E3A" strokeWidth="4" strokeLinecap="round" fill="none" />

      {/* hair & headwear */}
      <Hair look={look} />
      {look.scarf && (
        <>
          <path d="M46 102 C42 44 158 44 154 102 C148 70 128 56 100 56 C72 56 52 70 46 102Z" fill={look.scarf} />
          <path d="M42 112 C48 150 72 162 100 164 C128 162 152 150 158 112 L166 182 C140 196 60 196 34 182Z" fill={shade(look.scarf, -12)} />
        </>
      )}
      {look.chef && (
        <g>
          <path d="M62 56 C46 28 78 8 100 22 C122 8 154 28 138 56Z" fill="#fff" />
          <rect x="62" y="48" width="76" height="18" rx="8" fill="#F3EEF8" />
          <path d="M62 56 C46 28 78 8 100 22 C122 8 154 28 138 56Z" fill="url(#clay-shade)" />
        </g>
      )}
      {look.cap && (
        <g>
          <path d="M52 82 C52 34 148 34 148 82Z" fill={look.cap} />
          <path d="M60 80 C90 74 150 74 178 86 C160 94 110 92 60 88Z" fill={shade(look.cap, -25)} />
          <circle cx="100" cy="40" r="5" fill={shade(look.cap, -25)} />
        </g>
      )}
      {look.glasses && (
        <g>
          <g fill="rgba(255,255,255,.25)" stroke="#5A4370" strokeWidth="3.5">
            <circle cx="82" cy="100" r="13" />
            <circle cx="118" cy="100" r="13" />
          </g>
          <path d="M95 99 Q100 95 105 99" stroke="#5A4370" strokeWidth="3.5" fill="none" />
        </g>
      )}
      {look.bindi && <circle cx="100" cy="80" r="3.2" fill="#E2445C" />}
      {look.mustache && (
        <path d="M86 116 Q93 110 100 115 Q107 110 114 116 Q107 120 100 117 Q93 120 86 116Z" fill={look.hair} />
      )}

      {wave && (
        <g className="char-wave" style={{ transformOrigin: "150px 176px" }}>
          <path d="M146 180 C160 160 166 140 166 124" stroke={look.shirt} strokeWidth="20" strokeLinecap="round" fill="none" />
          <circle cx="167" cy="114" r="13" fill={s} />
          <circle cx="167" cy="114" r="13" fill="url(#clay-glow)" />
        </g>
      )}
    </svg>
  );
}
