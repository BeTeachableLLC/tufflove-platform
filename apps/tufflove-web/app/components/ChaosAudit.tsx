"use client";

import { useMemo, useState } from "react";

type DiagnosisKey = "Willpower" | "Hiring" | "SOPs" | "Execution";

const DIAGNOSES: Record<
  DiagnosisKey,
  { score: string; msg: string; order: string }
> = {
  Willpower: {
    score: "92%",
    msg: "You are the bottleneck. Reliance on willpower has reached critical levels.",
    order: "Deploy INTEL ENGINE immediately to map cognitive SOPs.",
  },
  Hiring: {
    score: "78%",
    msg: "Resource Hemorrhage detected in talent acquisition.",
    order: "Initialize WAR CHEST: Deploy Standard Hiring Protocol.",
  },
  SOPs: {
    score: "84%",
    msg: "Institutional Amnesia. Knowledge leaves with your employees.",
    order: "Initialize SOP GENERATOR to build a central repository of truth.",
  },
  Execution: {
    score: "89%",
    msg: "Velocity Collapse. Team has lost the rhythm of execution.",
    order: "Deploy MOMENTUM DASHBOARD: Force Level 10 meeting syncs.",
  },
};

export default function ChaosAudit() {
  const [selection, setSelection] = useState<DiagnosisKey | null>(null);
  const result = useMemo(() => (selection ? DIAGNOSES[selection] : null), [selection]);

  return (
    <section id="audit" className="js-reveal mx-auto mt-16 max-w-5xl px-6">
      <div className="relative min-h-[420px] rounded-[2rem] border border-pink-500/60 bg-white/5 p-10 text-center backdrop-blur-2xl">
        {!result ? (
          <div className="transition-opacity duration-500">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-pink-500">
              Chaos Audit v2.5
            </p>
            <h2 className="mt-6 text-xl font-bold uppercase tracking-[0.1em] text-white">
              Where is your company leaking profit?
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
              {[
                { label: "Managing via Willpower", key: "Willpower" },
                { label: "Inconsistent Hiring", key: "Hiring" },
                { label: "No Written SOPs", key: "SOPs" },
                { label: "Missed Execution Targets", key: "Execution" },
              ].map(({ label, key }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelection(key as DiagnosisKey)}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-white transition-all hover:border-pink-500/70 hover:bg-pink-500/10"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="transition-opacity duration-500">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-[#e61919]">
              System Diagnosis Complete
            </p>
            <div className="mt-4 text-5xl font-black text-[#e61919] drop-shadow-[0_0_20px_rgba(230,25,25,0.4)]">
              {result.score}
            </div>
            <p className="mt-4 text-sm text-zinc-400">{result.msg}</p>
            <div className="mt-8 rounded-2xl border border-white/20 border-dashed bg-white/5 p-6 text-left">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-pink-500">
                Executive Order
              </span>
              <p className="mt-3 text-sm text-white">{result.order}</p>
            </div>
            <a
              href="#pricing"
              className="mt-10 inline-flex items-center justify-center rounded-full bg-pink-600 px-10 py-4 text-[0.8rem] font-black uppercase tracking-[0.25em] text-white shadow-[0_0_30px_rgba(219,39,119,0.5)] transition-all hover:scale-[1.03] hover:shadow-[0_0_45px_rgba(219,39,119,0.7)]"
            >
              Initialize Command To Repair
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
