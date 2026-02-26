"use client";

import { useMemo, useState } from "react";
import styles from "./swot.module.css";
import { swotQuestions, SwotQuestion, SwotOption } from "@/lib/assessments/swotQuestions";

type CompanyOption = { id: string; name: string };

type Answer = {
  questionId: number;
  question: string;
  optionLabel: string;
  quadrant: SwotOption["quadrant"];
  response: string;
};

type StatusState = { type: "idle" | "saving" | "success" | "error"; message?: string };

const QUADRANTS: SwotOption["quadrant"][] = ["Strength", "Weakness", "Opportunity", "Threat"];

export default function SwotAssessment({
  companyOptions,
  defaultCompanyId,
}: {
  companyOptions: CompanyOption[];
  defaultCompanyId?: string | null;
}) {
  const [companyId, setCompanyId] = useState(defaultCompanyId || "");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Answer>>({});
  const [showResults, setShowResults] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });

  const totalQuestions = swotQuestions.length;
  const currentQuestion: SwotQuestion | undefined = swotQuestions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const completion = Math.round((answeredCount / totalQuestions) * 100);

  const grouped = useMemo(() => {
    const base: Record<SwotOption["quadrant"], Answer[]> = {
      Strength: [],
      Weakness: [],
      Opportunity: [],
      Threat: [],
    };
    Object.values(answers).forEach((answer) => {
      base[answer.quadrant].push(answer);
    });
    return base;
  }, [answers]);

  const counts = useMemo(() => {
    const tally: Record<SwotOption["quadrant"], number> = {
      Strength: 0,
      Weakness: 0,
      Opportunity: 0,
      Threat: 0,
    };
    Object.values(answers).forEach((answer) => {
      tally[answer.quadrant] += 1;
    });
    return tally;
  }, [answers]);

  const handleSelect = (question: SwotQuestion, option: SwotOption) => {
    setAnswers((prev) => ({
      ...prev,
      [question.id]: {
        questionId: question.id,
        question: question.question,
        optionLabel: option.label,
        quadrant: option.quadrant,
        response: option.response,
      },
    }));
    setStatus({ type: "idle" });
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    if (!answers[currentQuestion.id]) {
      setStatus({ type: "error", message: "Choose an option to continue." });
      return;
    }
    if (currentIndex >= totalQuestions - 1) {
      setShowResults(true);
      return;
    }
    setCurrentIndex((prev) => Math.min(prev + 1, totalQuestions - 1));
  };

  const handleBack = () => {
    if (showResults) {
      setShowResults(false);
      return;
    }
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleReset = () => {
    setAnswers({});
    setCurrentIndex(0);
    setShowResults(false);
    setStatus({ type: "idle" });
  };

  const buildPayload = () => {
    const responseList = swotQuestions.map((question) => {
      const selected = answers[question.id] || null;
      return {
        id: question.id,
        question: question.question,
        selected,
      };
    });

    return {
      responses: { answers: responseList },
      results: {
        answeredCount,
        totalQuestions,
        counts,
        quadrants: Object.fromEntries(
          QUADRANTS.map((quadrant) => [
            quadrant,
            grouped[quadrant].map((answer) => ({
              questionId: answer.questionId,
              question: answer.question,
              response: answer.response,
            })),
          ])
        ),
      },
    };
  };

  const handleSave = async () => {
    if (answeredCount < totalQuestions) {
      setStatus({ type: "error", message: "Finish all questions before saving." });
      return;
    }
    setStatus({ type: "saving" });

    try {
      const payload = buildPayload();
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_type: "swot",
          company_id: companyId || null,
          responses: payload.responses,
          results: payload.results,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Unable to save assessment.");
      }
      setStatus({ type: "success", message: "SWOTify Assessment saved." });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unable to save assessment.";
      setStatus({ type: "error", message });
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>SWOTify Assessment</h1>
            <p className={styles.subtitle}>
              Answer each prompt to map your strengths, weaknesses, opportunities, and threats.
            </p>
          </div>
          <div className={styles.companySelect}>
            <label>Attach to company (optional)</label>
            <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              <option value="">Personal (no company)</option>
              {companyOptions.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.progressWrap}>
          <div className={styles.progressFill} style={{ width: `${completion}%` }} />
        </div>

        {!showResults && currentQuestion && (
          <div className={styles.card}>
            <div className={styles.questionLabel}>
              Question {currentIndex + 1} of {totalQuestions}
            </div>
            <div className={styles.questionText}>{currentQuestion.question}</div>
            <div className={styles.options}>
              {currentQuestion.options.map((option) => {
                const isSelected = answers[currentQuestion.id]?.optionLabel === option.label;
                return (
                  <button
                    key={`${currentQuestion.id}-${option.label}`}
                    type="button"
                    className={`${styles.optionButton} ${isSelected ? styles.optionSelected : ""}`}
                    onClick={() => handleSelect(currentQuestion, option)}
                  >
                    <span>{option.label}</span>
                    <span className={styles.optionTag}>{option.quadrant}</span>
                  </button>
                );
              })}
            </div>

            <div className={styles.nav}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={handleBack}
                disabled={currentIndex === 0}
              >
                Back
              </button>
              <button type="button" className={styles.button} onClick={handleNext}>
                {currentIndex === totalQuestions - 1 ? "View Results" : "Next"}
              </button>
              <button type="button" className={styles.buttonGhost} onClick={handleReset}>
                Reset
              </button>
            </div>

            {status.type === "error" && <div className={`${styles.status} ${styles.statusError}`}>{status.message}</div>}
          </div>
        )}

        {showResults && (
          <div className={styles.card}>
            <div className={styles.questionText}>Your SWOT Summary</div>
            <div className={styles.summaryRow}>
              <span>{answeredCount} of {totalQuestions} answered</span>
              <span>{completion}% complete</span>
            </div>
            <div className={styles.resultsGrid}>
              {QUADRANTS.map((quadrant) => (
                <div key={quadrant} className={styles.resultCard}>
                  <div className={styles.resultTitle}>{quadrant}</div>
                  {grouped[quadrant].length === 0 ? (
                    <div className={styles.summaryRow}>No responses yet.</div>
                  ) : (
                    <ul className={styles.resultList}>
                      {grouped[quadrant].map((answer) => (
                        <li key={`${quadrant}-${answer.questionId}`}>{answer.response}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.nav}>
              <button type="button" className={`${styles.button} ${styles.buttonSecondary}`} onClick={handleBack}>
                Back to Questions
              </button>
              <button type="button" className={styles.button} onClick={handleSave}>
                {status.type === "saving" ? "Saving..." : "Save Results"}
              </button>
              <button type="button" className={styles.buttonGhost} onClick={handleReset}>
                Start Over
              </button>
            </div>

            {status.type === "error" && <div className={`${styles.status} ${styles.statusError}`}>{status.message}</div>}
            {status.type === "success" && <div className={`${styles.status} ${styles.statusSuccess}`}>{status.message}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
