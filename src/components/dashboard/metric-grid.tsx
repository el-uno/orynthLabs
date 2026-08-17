import type { MetricCard } from "@/lib/types";

export function MetricGrid({ cards }: { cards: MetricCard[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10"
        >
          <p className="text-sm text-slate-400">{card.label}</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <strong className="text-3xl font-semibold">{card.value}</strong>
            <span className="text-sm text-emerald-300">{card.delta}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
