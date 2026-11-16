/** Shared SVG gradients that give every character its soft clay shading. Rendered once in the root layout. */
export function ClayDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <radialGradient id="clay-glow" cx="35%" cy="28%" r="70%">
          <stop offset="0" stopColor="#fff" stopOpacity=".45" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="clay-shade" cx="50%" cy="20%" r="85%">
          <stop offset=".6" stopColor="#3D2C5A" stopOpacity="0" />
          <stop offset="1" stopColor="#3D2C5A" stopOpacity=".22" />
        </radialGradient>
      </defs>
    </svg>
  );
}
