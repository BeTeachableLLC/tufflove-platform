import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TUFF LOVE | Privacy Protocol",
  description:
    "TUFF LOVE privacy protocol covering data collection, use, communications, and data rights.",
};

export default function PrivacyProtocolPage() {
  return (
    <main className="min-h-screen bg-black px-6 pb-24 pt-32 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-[0.7rem] uppercase tracking-[0.4em] text-white/50">
          TUFF LOVE
        </p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-tight md:text-5xl">
          Privacy Protocol
        </h1>
        <p className="mt-4 text-sm uppercase tracking-[0.25em] text-white/50">
          Last Updated: February 12, 2026
        </p>

        <section className="mt-12 space-y-6 text-sm leading-relaxed text-zinc-300">
          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              1. Introduction
            </h2>
            <p className="mt-3">
              At TUFF LOVE (operated by BeTeachable), we are committed to protecting
              the integrity of the data that powers your business operating system.
              This Privacy Protocol explains how we collect, use, disclose, and
              safeguard your information when you initialize command on our
              website or use our executive services. If you do not agree with the
              terms of this protocol, please do not access the site or deploy the
              OS.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              2. Information Collection
            </h2>
            <p className="mt-3">
              We collect the data necessary to replace chaos with systems. This
              includes:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>
                <span className="font-semibold text-white">Personal Data:</span>{" "}
                Identifiable information (name, email, phone number) voluntarily
                provided during registration or consultation booking.
              </li>
              <li>
                <span className="font-semibold text-white">Derivative Data:</span>{" "}
                Information our servers automatically collect (IP address, browser
                type, access times) to optimize your OS experience.
              </li>
              <li>
                <span className="font-semibold text-white">Financial Data:</span>{" "}
                Payment information (credit card details, billing address)
                processed through our secure encrypted gateways for Command and
                Unit licenses.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              3. Use of Information
            </h2>
            <p className="mt-3">Your data is utilized to maintain execution velocity:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>To operate and maintain the TUFF LOVE Operating System.</li>
              <li>To process transactions and manage your licensing orders.</li>
              <li>
                To communicate via SMS or AI-assisted callers for system updates,
                notifications, and "Momentum" alerts.
              </li>
              <li>
                To personalize your dashboard based on your Chaos Audit results.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              4. SMS and AI Communications
            </h2>
            <p className="mt-3">
              By providing your phone number, you agree to receive communications
              from TUFF LOVE. These may include service updates, automated "Level
              10" meeting reminders, and promotional intelligence. You may opt-out
              at any time by following the unsubscribe protocols in the messages.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              5. Disclosure &amp; Security
            </h2>
            <p className="mt-3">
              We share information only by law or to protect the rights of the
              BeTeachable ecosystem. We utilize administrative, technical, and
              physical security measures to protect your personal information.
              However, as "Systems Beat Moods," we recognize that no digital
              environment is 100% secure and encourage users to maintain robust
              local security protocols.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              6. Contact &amp; Data Rights
            </h2>
            <p className="mt-3">
              You maintain the right to access, correct, or delete your personal
              information within the TUFF LOVE framework. For inquiries regarding
              your data, contact the Command Center:
            </p>
            <div className="mt-4 space-y-2 text-sm text-white">
              <p>TUFF LOVE / BeTeachable</p>
              <p>
                Email:{" "}
                <a
                  href="mailto:Moe@beteachable.com"
                  className="font-semibold text-white underline decoration-pink-500/60"
                >
                  Moe@beteachable.com
                </a>
              </p>
              <p>
                Support:{" "}
                <a
                  href="https://api.beteachable.com/widget/bookings/discoverysessionquickconnect"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-white underline decoration-pink-500/60"
                >
                  Book a Discovery Session
                </a>
              </p>
            </div>
          </div>
        </section>

        <div className="mt-16 text-xs uppercase tracking-[0.25em] text-white/40">
          <Link href="/" className="hover:text-white">
            Return to Command
          </Link>
        </div>
      </div>
    </main>
  );
}
