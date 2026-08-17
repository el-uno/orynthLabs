const focusAreas = [
  "Launch intelligence dashboard",
  "On-chain + social signal ingestion",
  "Backend-only signing boundary",
  "Scalable worker-friendly architecture"
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16">
      <section className="max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/20 backdrop-blur">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-emerald-300/90">
          Orynth ProductLab
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          A focused 4-week scaffold for the alpha.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
          This starter repo is set up for a credible first release: Next.js,
          TypeScript, Tailwind, shadcn-ready UI patterns, and a backend model
          that keeps sensitive signing logic off the frontend.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {focusAreas.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200"
            >
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
