"use client";

type MouseEventHandler = React.MouseEvent<HTMLDivElement>;

const setGlowVars = (event: MouseEventHandler) => {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  target.style.setProperty("--mouse-x", `${x}px`);
  target.style.setProperty("--mouse-y", `${y}px`);
};

export default function PricingSection() {
  return (
    <section id="pricing" className="py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-6 md:grid-cols-2">
        <div
          className="price-card js-reveal reveal-delay-1 relative rounded-[2.5rem] border border-pink-500/40 bg-[linear-gradient(145deg,rgba(20,10,15,0.8),rgba(5,5,5,0.8))] p-14 text-left shadow-[0_0_60px_-20px_rgba(219,39,119,0.3)] backdrop-blur-xl transition-all hover:-translate-y-3 hover:border-pink-500"
          onMouseMove={setGlowVars}
        >
          <span className="absolute right-10 top-10 text-[0.65rem] font-bold uppercase tracking-[0.35em] text-pink-500">
            Command Center
          </span>
          <h3 className="mt-4 text-3xl font-black uppercase tracking-[-0.02em]">
            Command License
          </h3>
          <div className="mt-6 flex items-baseline gap-2 text-[4rem] font-black tracking-[-0.05em]">
            $24.95
            <span className="text-base font-bold text-zinc-600">/ mo</span>
          </div>
          <a
            href="https://portal.tufflove.us/checkout/command"
            className="mt-10 inline-flex w-full items-center justify-center rounded-full bg-pink-600 px-10 py-4 text-[0.8rem] font-black uppercase tracking-[0.25em] text-white shadow-[0_0_30px_rgba(219,39,119,0.5)] transition-all hover:scale-[1.03] hover:shadow-[0_0_45px_rgba(219,39,119,0.7)]"
          >
            Initialize Command
          </a>
        </div>

        <div
          className="price-card js-reveal reveal-delay-2 rounded-[2.5rem] border border-white/10 bg-white/5 p-14 text-left backdrop-blur-xl transition-all hover:-translate-y-3 hover:border-pink-500/40"
          onMouseMove={setGlowVars}
        >
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.35em] text-white/50">
            Team Expansion
          </span>
          <h3 className="mt-4 text-3xl font-black uppercase tracking-[-0.02em]">
            Unit Scaling
          </h3>
          <div className="mt-6 flex items-baseline gap-2 text-[4rem] font-black tracking-[-0.05em]">
            $4.95
            <span className="text-base font-bold text-zinc-600">/ user</span>
          </div>
          <a
            href="https://portal.tufflove.us/checkout/unit"
            className="mt-10 inline-flex w-full items-center justify-center rounded-full border border-pink-500/80 bg-transparent px-10 py-4 text-[0.8rem] font-black uppercase tracking-[0.25em] text-white shadow-[0_0_30px_rgba(219,39,119,0.3)] transition-all hover:scale-[1.03] hover:border-pink-500 hover:shadow-[0_0_45px_rgba(219,39,119,0.5)]"
          >
            Scale Your Team
          </a>
        </div>
      </div>
    </section>
  );
}
