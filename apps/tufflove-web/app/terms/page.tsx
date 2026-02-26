import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TUFF LOVE | Terms of Command",
  description:
    "TUFF LOVE Terms of Command covering license, eligibility, prohibited activities, and liability.",
};

export default function TermsOfCommandPage() {
  return (
    <main className="min-h-screen bg-black px-6 pb-24 pt-32 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="text-[0.7rem] uppercase tracking-[0.4em] text-white/50">
          TUFF LOVE
        </p>
        <h1 className="mt-4 text-4xl font-black uppercase tracking-tight md:text-5xl">
          Terms of Command
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
              Welcome to TUFF LOVE. These Terms of Command outline the rules and
              regulations for the use of the TUFF LOVE Operating System and its
              associated services. By accessing this website or initializing
              command, we assume you accept these terms in full. Do not continue
              to use TUFF LOVE if you do not agree to all terms stated on this
              page.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              2. License to Operate
            </h2>
            <p className="mt-3">
              Unless otherwise stated, BeTeachable owns the intellectual property
              rights for all material on TUFF LOVE. All intellectual property
              rights are reserved. You may access this from TUFF LOVE for your
              personal or business use subject to the following restrictions:
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>You must not republish material from the TUFF LOVE Command Center.</li>
              <li>
                You must not sell, rent, or sub-license material or SOPs generated
                by the OS.
              </li>
              <li>
                You must not reproduce, duplicate, or copy the TUFF LOVE framework
                for redistribution.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              3. User Eligibility &amp; Accounts
            </h2>
            <p className="mt-3">
              You must be at least 18 years of age to initialize command. When
              creating an account, you must provide accurate and complete
              information. You are responsible for the confidentiality of your
              account details and for all activities that occur under your
              specific "Unit" or "Command" license.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              4. Prohibited Activities
            </h2>
            <p className="mt-3">As an operator of this OS, you agree not to:</p>
            <ul className="mt-4 list-disc space-y-2 pl-6">
              <li>Engage in fraudulent activity or illegal purposes.</li>
              <li>
                Attempt to gain unauthorized access to other "Command" environments
                or related systems.
              </li>
              <li>
                Use the website in any way that causes harm to the system or its
                users.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              5. Termination of Use
            </h2>
            <p className="mt-3">
              We may suspend or terminate your access to the TUFF LOVE OS
              immediately, without notice, if we believe you have violated these
              terms or any applicable law. Upon termination, your right to use the
              services and access the "War Chest" will cease immediately.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              6. Limitation of Liability
            </h2>
            <p className="mt-3">
              In no event shall TUFF LOVE or BeTeachable be liable for any damages
              arising out of your use of or inability to use this operating
              system. While "Systems Beat Moods," we do not warrant that the
              website will be uninterrupted or error-free.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              7. Governing Law
            </h2>
            <p className="mt-3">
              These terms are governed by and construed in accordance with the
              laws of Pasco County, FL, United States. You irrevocably submit to
              the exclusive jurisdiction of the courts in that location.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">
              8. Contact Information
            </h2>
            <p className="mt-3">
              If you have any questions regarding these Terms of Command, please
              contact the Command Center:
            </p>
            <div className="mt-4 text-sm text-white">
              <p>
                Email:{" "}
                <a
                  href="mailto:Moe@beteachable.com"
                  className="font-semibold text-white underline decoration-pink-500/60"
                >
                  Moe@beteachable.com
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
