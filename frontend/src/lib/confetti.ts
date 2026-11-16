const COLORS = ["#C2EF6B", "#FF8C73", "#74CCEC", "#B39DF5", "#FFD66B", "#FFB8CB"];

/** Burst pastel confetti from the centre of an element. Skipped when the user prefers reduced motion. */
export function burstConfetti(from: Element, pieces = 36) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = from.getBoundingClientRect();
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement("span");
    p.className = "confetti-piece";
    const angle = Math.random() * Math.PI * 2;
    const dist = 80 + Math.random() * 160;
    p.style.left = `${r.left + r.width / 2}px`;
    p.style.top = `${r.top + r.height / 2}px`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.borderRadius = i % 3 ? "4px" : "50%";
    p.style.setProperty("--x", `${Math.cos(angle) * dist}px`);
    p.style.setProperty("--y", `${Math.sin(angle) * dist - 60}px`);
    p.style.setProperty("--r", `${Math.random() * 720}deg`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}
