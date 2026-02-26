import { redirect } from "next/navigation";
import Link from "next/link";
import ChaosAudit from "@/app/components/ChaosAudit";
import HeroVideo from "@/app/components/HeroVideo";
import PricingSection from "@/app/components/PricingSection";
import PublicFrontEffects from "@/app/components/PublicFrontEffects";

type SearchParams = Promise<{
  code?: string;
  access_token?: string;
  refresh_token?: string;
  type?: string;
  next?: string;
  redirect_to?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
}>;

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TUFF LOVE Operating System",
  operatingSystem: "Web-based",
  applicationCategory: "BusinessApplication",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    ratingCount: "1300",
  },
  offers: {
    "@type": "Offer",
    price: "24.95",
    priceCurrency: "USD",
  },
};

export default async function Home(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const authParams = ["code", "access_token", "refresh_token", "type", "next", "redirect_to"];
  const hasAuthParams = authParams.some((key) => Boolean(searchParams[key as keyof typeof searchParams]));
  const errorDescription = searchParams.error_description || searchParams.error_code || searchParams.error;
  const hasAuthError = Boolean(errorDescription);

  if (hasAuthParams) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams)) {
      if (!value) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          params.append(key, item);
        }
      } else {
        params.append(key, value);
      }
    }

    const query = params.toString();
    redirect(`/auth/callback${query ? `?${query}` : ""}`);
  }

  if (hasAuthError) {
    const message = Array.isArray(errorDescription)
      ? errorDescription[0]
      : errorDescription;
    const encoded = encodeURIComponent(message || "Sign-in failed");
    redirect(`/sign-in?error=${encoded}`);
  }

  return (
    <main className="min-h-screen bg-black text-white antialiased">
      <script
        type="application/ld+json"
        // JSON-LD must be a string for search engines.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <PublicFrontEffects />
      <header className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-black/95 backdrop-blur-[20px]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-[5%] py-4">
          <Link href="/" className="group flex items-center gap-6 text-white">
            <img
              src="/logo.png"
              alt="BeTeachable"
              className="h-14 w-auto drop-shadow-[0_0_15px_rgba(255,255,255,0.25)] transition-transform duration-300 group-hover:scale-[1.05] md:h-[4.8rem]"
            />
            <div className="flex flex-col border-l-2 border-pink-500/50 pl-6">
              <span className="text-[1.8rem] font-black uppercase tracking-[-0.02em] leading-none">
                TUFF LOVE
              </span>
              <span className="mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.4em] text-white/50">
                BeTeachable V2
              </span>
            </div>
          </Link>
          <nav className="hidden items-center gap-8 lg:flex">
            <a
            href="https://app.tufflove.us/sign-in"
              className="mr-6 text-[11px] uppercase tracking-[0.3em] text-white/40 transition-all hover:text-white"
            >
              Login
            </a>
            <a
              href="https://api.beteachable.com/widget/bookings/discoverysessionquickconnect"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] uppercase tracking-[0.3em] border border-white/20 px-8 py-3 rounded-full transition-all hover:bg-white hover:text-black"
            >
              Consultation
            </a>
            <a
              href="#pricing"
              className="ml-4 rounded-full bg-pink-600 px-8 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_35px_rgba(219,39,119,0.45)] transition-all hover:translate-y-[-5px] hover:shadow-[0_0_55px_rgba(219,39,119,0.7)]"
            >
              Get Access
            </a>
          </nav>
        </div>
      </header>

      <section className="pt-[16rem] text-center px-6">
        <h1 className="js-reveal text-7xl font-black tracking-tighter leading-[0.8] md:text-[11rem]">
          SYSTEMS.
          <br />
          BEAT.
          <br />
          <span className="moods-glow">MOODS.</span>
        </h1>
        <p className="js-reveal mt-6 text-[10px] uppercase tracking-[0.6em] text-zinc-500 md:text-xs">
          The Operating System for Business Leaders Done with Chaos.
        </p>
        <div className="js-reveal mt-20">
          <a
            href="#audit"
            className="inline-flex items-center justify-center rounded-full bg-pink-600 px-12 py-4 text-[0.85rem] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_35px_rgba(219,39,119,0.45)] transition-all hover:translate-y-[-5px] hover:shadow-[0_0_55px_rgba(219,39,119,0.7)]"
          >
            Initialize Command
          </a>
        </div>
      </section>

      <section className="js-reveal mx-auto mb-40 max-w-5xl px-6">
        <HeroVideo />
      </section>

      <ChaosAudit />

      <section className="ticker-bar">
        <div className="ticker-content">
          <span className="ticker-word">No Accountability</span>
          <span className="ticker-word">Leaking Profit</span>
          <span className="ticker-word">Bad Hires</span>
          <span className="ticker-word">Missed Deadlines</span>
          <span className="ticker-word">Chaos</span>
          <span className="ticker-word">No Accountability</span>
          <span className="ticker-word">Leaking Profit</span>
          <span className="ticker-word">Bad Hires</span>
          <span className="ticker-word">Missed Deadlines</span>
          <span className="ticker-word">Chaos</span>
        </div>
      </section>

      <section id="preview" className="js-reveal mx-auto mt-20 max-w-6xl px-6 text-center">
        <div className="rounded-[2rem] border border-white/10 bg-[#080808] p-6 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-white/5 px-4 pb-4">
            <span className="text-[10px] uppercase tracking-[0.3em] text-pink-500">
              Operator Console: Level 10 Sync
            </span>
          </div>
          <div className="grid gap-6 px-4 pt-8 md:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-6 text-left">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                Strategy Velocity
              </p>
              <p className="mt-4 text-3xl font-black text-white">78% Sync</p>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[78%] rounded-full bg-pink-500 shadow-[0_0_10px_rgba(219,39,119,0.6)]" />
              </div>
            </div>
            <div className="rounded-2xl bg-white/5 p-6 text-left">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                Active Intelligence
              </p>
              <p className="mt-4 text-xl font-bold text-white">
                14 SOPs Generated
              </p>
            </div>
          </div>
        </div>
      </section>

      <PricingSection />

      <footer
        id="support"
        className="mt-24 border-t border-white/15 bg-[#020202] px-6 pb-20 pt-40 text-center"
      >
        <img
          src="/logo.png"
          alt="BeTeachable"
          className="mx-auto h-[5.5rem] drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]"
        />
        <div className="mt-12 text-[0.85rem] uppercase tracking-[0.25em] text-zinc-400 leading-[2.5]">
          © 2026{" "}
          <a
            href="https://beteachable.com"
            className="font-bold text-white transition hover:text-pink-500"
          >
            BE TEACHABLE
          </a>{" "}
          • ALL RIGHTS RESERVED
          <br />
          TUFF LOVE OPERATING SYSTEM V2.5.0
          <br />
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/terms_of_service.md"
              className="font-bold text-white transition hover:text-pink-500"
            >
              TERMS
            </a>
            <span className="text-white/40">•</span>
            <a
              href="/privacy_policy.md"
              className="font-bold text-white transition hover:text-pink-500"
            >
              PRIVACY
            </a>
            <span className="text-white/40">•</span>
            <a
              href="https://api.beteachable.com/widget/bookings/discoverysessionquickconnect"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-white transition hover:text-pink-500"
            >
              SUPPORT
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
