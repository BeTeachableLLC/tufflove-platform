"use client";

import { useMemo, useState } from "react";
import { getDnaCompletion, getMissingDnaFields, formatMissingFields } from "@/lib/dna";

const STEP_LABELS = ["Core DNA", "Positioning", "Notes & Brain"];

export default function DnaWizard({
  action,
  initialValues,
  title = "DNA Builder",
  description = "Start with the 5 core fields. The rest is optional.",
  submitLabel = "Save DNA",
}: {
  action: (formData: FormData) => void | Promise<void>;
  initialValues?: Record<string, string | null | undefined>;
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const [step, setStep] = useState(0);
  const [formState, setFormState] = useState({
    core_promise: initialValues?.core_promise || "",
    voice_rules: initialValues?.voice_rules || "",
    audience: initialValues?.audience || "",
    offers: initialValues?.offers || "",
    non_negotiables: initialValues?.non_negotiables || "",
    scoreboard: initialValues?.scoreboard || "",
    dna_text: initialValues?.dna_text || "",
    brain_text: initialValues?.brain_text || "",
    notes: initialValues?.notes || "",
  });

  const missingFields = useMemo(() => getMissingDnaFields(formState), [formState]);
  const completion = useMemo(() => getDnaCompletion(formState), [formState]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const canGoBack = step > 0;
  const canGoNext = step < STEP_LABELS.length - 1;

  return (
    <form
      action={action}
      style={{
        backgroundColor: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        display: "grid",
        gap: "12px",
      }}
    >
      <div>
        <h3 style={{ marginTop: 0, marginBottom: "4px", fontSize: "16px" }}>{title}</h3>
        <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#6B7280" }}>{description}</p>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", fontSize: "12px", color: "#6B7280" }}>
          <span>Progress</span>
          <span>{completion.completed}/{completion.total} required · {completion.percent}%</span>
        </div>
        <div style={{ height: "8px", backgroundColor: "#E5E7EB", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${completion.percent}%`, backgroundColor: "#2563eb" }} />
        </div>
      </div>

      {missingFields.length > 0 && (
        <div style={{ backgroundColor: "#FEF3C7", border: "1px solid #FDE68A", color: "#92400E", padding: "10px 12px", borderRadius: "10px", fontSize: "12px" }}>
          Missing required fields: {formatMissingFields(missingFields).join(", ")}.
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", fontSize: "12px" }}>
        {STEP_LABELS.map((label, index) => (
          <div
            key={label}
            style={{
              padding: "6px 10px",
              borderRadius: "999px",
              backgroundColor: step === index ? "#111827" : "#E5E7EB",
              color: step === index ? "#fff" : "#374151",
              fontWeight: step === index ? 700 : 600,
            }}
          >
            {label}
          </div>
        ))}
      </div>

      {step === 0 && (
        <div style={{ display: "grid", gap: "12px" }}>
          <input
            name="core_promise"
            placeholder="Core promise"
            value={formState.core_promise}
            onChange={handleChange}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
          />
          <textarea
            name="voice_rules"
            placeholder="Voice rules & tone"
            value={formState.voice_rules}
            onChange={handleChange}
            rows={3}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
          />
          <textarea
            name="audience"
            placeholder="Audience DNA"
            value={formState.audience}
            onChange={handleChange}
            rows={3}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
          />
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "grid", gap: "12px" }}>
          <textarea
            name="offers"
            placeholder="Offers & outcomes"
            value={formState.offers}
            onChange={handleChange}
            rows={3}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
          />
          <textarea
            name="non_negotiables"
            placeholder="Non-negotiables & standards"
            value={formState.non_negotiables}
            onChange={handleChange}
            rows={3}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
          />
          <textarea
            name="scoreboard"
            placeholder="Scoreboard or KPIs"
            value={formState.scoreboard}
            onChange={handleChange}
            rows={3}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
          />
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: "12px" }}>
          <textarea
            name="dna_text"
            placeholder="Paste your DNA (summary)"
            value={formState.dna_text}
            onChange={handleChange}
            rows={4}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
          />
          <textarea
            name="brain_text"
            placeholder="Brain notes (strategy, rules, frameworks)"
            value={formState.brain_text}
            onChange={handleChange}
            rows={4}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
          />
          <textarea
            name="notes"
            placeholder="Additional notes"
            value={formState.notes}
            onChange={handleChange}
            rows={3}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #D1D5DB" }}
          />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginTop: "4px" }}>
        <button
          type="button"
          onClick={() => setStep((prev) => Math.max(0, prev - 1))}
          disabled={!canGoBack}
          style={{
            backgroundColor: canGoBack ? "#E5E7EB" : "#F3F4F6",
            color: "#374151",
            padding: "8px 14px",
            borderRadius: "8px",
            border: "none",
            fontWeight: 600,
            cursor: canGoBack ? "pointer" : "not-allowed",
          }}
        >
          Back
        </button>
        {canGoNext ? (
          <button
            type="button"
            onClick={() => setStep((prev) => Math.min(STEP_LABELS.length - 1, prev + 1))}
            style={{
              backgroundColor: "#111827",
              color: "#fff",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            style={{
              backgroundColor: "#111827",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: "8px",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
