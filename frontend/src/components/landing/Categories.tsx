import Link from "next/link";
import { CATEGORY_TILES } from "@/lib/categories";
import { SectionHead } from "./SectionHead";

export function Categories() {
  return (
    <section id="categories" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-14 sm:px-6">
      <SectionHead kicker="Everything has a place" title="What can be reborn?">
        Food, furniture, gadgets, building materials, clothes. If it still has value, someone nearby can use it.
      </SectionHead>
      <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 lg:grid-cols-7">
        {CATEGORY_TILES.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/listings?category=${c.slug}`}
              className="clay-sm block w-full cursor-pointer rounded-3xl bg-card px-2.5 pb-3.5 pt-4 text-center transition-transform duration-200 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] hover:-translate-y-1.5 hover:-rotate-[1.5deg]"
            >
              <span className={`mx-auto mb-2.5 grid h-[60px] w-[60px] place-items-center rounded-[20px] text-[1.8rem] shadow-[inset_0_-5px_0_rgb(61_44_90/0.1),inset_0_4px_8px_rgb(255_255_255/0.6),0_8px_14px_-8px_rgb(61_44_90/0.35)] ${c.tint}`}>
                {c.icon}
              </span>
              <b className="block font-display text-base leading-tight">{c.name}</b>
              <small className="text-[0.78rem] font-bold text-plum-soft">{c.hint}</small>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
