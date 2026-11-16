import { SectionHead } from "./SectionHead";

const STAGES = [
  {
    step: "Chance 1", title: "Free for those in need", bg: "bg-lime-t",
    body: "Verified NGOs, schools, shelters and individuals claim it first, at no cost.",
    rows: [["🍲 Cooked food", "2 hours"], ["🪑 Furniture", "5 days"], ["💻 Electronics", "7 days"]],
  },
  {
    step: "Chance 2", title: "Low-price marketplace", bg: "bg-sky-t",
    body: "Unclaimed items go on sale to anyone, at an AI-suggested fair price. Pay with UPI.",
    rows: [["Laptop (2019)", "₹6,500"], ["Office chair", "₹900"], ["Textbooks (set of 8)", "₹350"]],
  },
  {
    step: "Chance 3", title: "Repair or recycle", bg: "bg-lavender-t",
    body: "Repair cafés and artisans fix what they can. Authorised recyclers take the rest.",
    rows: [["♻️ E-waste recycler", "₹22/kg"], ["🔧 Repair café", "2.4 km"], ["🧵 Upcycling artisan", "Fabric"]],
  },
];

export function Journey() {
  return (
    <section id="journey" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-14 sm:px-6">
      <SectionHead kicker="The REBIRTH promise" title="People first. Then everyone. Never the bin.">
        Every item moves through three chances. Each step has its own colour, so you always know where something stands.
      </SectionHead>
      <ol className="grid gap-6 md:grid-cols-3">
        {STAGES.map((s, i) => (
          <li key={s.step} className={`clay relative min-w-0 rounded-[2.25rem] p-6 ${s.bg}`}>
            <span className="inline-block rounded-full bg-white/70 px-3 py-0.5 font-display text-sm font-extrabold">{s.step}</span>
            <h3 className="mt-3 text-[1.7rem] font-bold">{s.title}</h3>
            <p className="mt-2 opacity-80">{s.body}</p>
            <ul className="mt-3.5 grid gap-1.5">
              {s.rows.map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2 rounded-xl bg-white/65 px-2.5 py-1.5 text-sm font-bold">
                  <span>{k}</span>
                  <span>{v}</span>
                </li>
              ))}
            </ul>
            {i < STAGES.length - 1 && (
              <span aria-hidden="true" className="clay-sm absolute -bottom-6 left-1/2 z-10 grid h-8 w-8 -translate-x-1/2 rotate-90 place-items-center rounded-full bg-butter font-extrabold md:-right-[26px] md:bottom-auto md:left-auto md:top-1/2 md:translate-x-0 md:rotate-0">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
