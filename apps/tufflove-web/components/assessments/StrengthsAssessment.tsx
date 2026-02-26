"use client";

import { useMemo, useState } from "react";
import { strengthsQuestions } from "@/lib/assessments/strengthsQuestions";
import styles from "./strengths.module.css";

type CompanyOption = { id: string; name: string };

type Answer = {
  questionId: number;
  question: string;
  optionIndex: number;
  optionText: string;
  weight: string;
  section: string;
};

type StatusState = { type: "idle" | "saving" | "success" | "error"; message?: string };

type FlatQuestion = {
  id: number;
  question: string;
  options: { text: string; weight: string }[];
  section: string;
};

type StrengthsQuestion = {
  id: number;
  question: string;
  options: { text: string; weight: string }[];
};

type StrengthsSection = {
  section: string;
  questions: StrengthsQuestion[];
};

const PROFILE_LABELS: Record<string, string> = {
  A: "Driver",
  B: "Influencer",
  C: "Supporter",
  D: "Analyzer",
};

export default function StrengthsAssessment({
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

  const flatQuestions: FlatQuestion[] = useMemo(() => {
    return (strengthsQuestions as unknown as StrengthsSection[]).flatMap((section) =>
      section.questions.map((question) => ({
        id: question.id,
        question: question.question,
        options: question.options,
        section: section.section,
      }))
    );
  }, []);

  const totalQuestions = flatQuestions.length;
  const currentQuestion = flatQuestions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const completion = Math.round((answeredCount / totalQuestions) * 100);

  const scoreBreakdown = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    Object.values(answers).forEach((entry) => {
      if (counts[entry.weight] !== undefined) {
        counts[entry.weight] += 1;
      }
    });

    const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
    const sorted = Object.entries(counts)
      .map(([key, value]) => ({
        key,
        value,
        percent: Math.round((value / total) * 100),
        label: PROFILE_LABELS[key] || key,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      counts,
      sorted,
      total,
      dominant: sorted[0] || null,
      secondary: sorted[1] || null,
    };
  }, [answers]);

  const handleSelect = (question: FlatQuestion, optionIndex: number) => {
    const option = question.options[optionIndex];
    setAnswers((prev) => ({
      ...prev,
      [question.id]: {
        questionId: question.id,
        question: question.question,
        optionIndex,
        optionText: option.text,
        weight: option.weight,
        section: question.section,
      },
    }));
    setStatus({ type: "idle" });
  };

  const handleNext = () => {
    if (!currentQuestion) return;
    if (!answers[currentQuestion.id]) {
      setStatus({ type: "error", message: "Select an option before continuing." });
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
    const responseList = flatQuestions.map((question) => {
      const selected = answers[question.id] || null;
      return {
        id: question.id,
        question: question.question,
        section: question.section,
        selected,
      };
    });

    return {
      responses: { answers: responseList },
      results: {
        answeredCount,
        totalQuestions,
        counts: scoreBreakdown.counts,
        dominant: scoreBreakdown.dominant,
        secondary: scoreBreakdown.secondary,
      },
    };
  };

  const handleSave = async () => {
    if (answeredCount < totalQuestions) {
      setStatus({ type: "error", message: "Finish the assessment before saving." });
      return;
    }

    setStatus({ type: "saving" });
    try {
      const payload = buildPayload();
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_type: "strengths_matrix",
          company_id: companyId || null,
          responses: payload.responses,
          results: payload.results,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Unable to save assessment.");
      }
      setStatus({ type: "success", message: "Strengths Matrix Assessment saved." });
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
            <h1 className={styles.title}>Strengths Matrix Assessment</h1>
            <p className={styles.subtitle}>
              Pick the option that fits best. Your profile updates as you progress.
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

        <div className={styles.progressShell}>
          <div className={styles.progressFill} style={{ width: `${completion}%` }} />
        </div>

        {!showResults && currentQuestion && (
          <div className={styles.card}>
            <div className={styles.questionCounter}>
              Question {currentIndex + 1} of {totalQuestions}
            </div>
            <div className={styles.questionText}>{currentQuestion.question}</div>
            <div className={styles.optionList}>
              {currentQuestion.options.map((option, index) => {
                const selected = answers[currentQuestion.id]?.optionIndex === index;
                return (
                  <button
                    key={`${currentQuestion.id}-${index}`}
                    type="button"
                    className={`${styles.optionButton} ${selected ? styles.optionSelected : ""}`}
                    onClick={() => handleSelect(currentQuestion, index)}
                  >
                    <span>{option.text}</span>
                    <span className={styles.optionBadge}>{option.weight}</span>
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
            <div className={styles.questionText}>Your Strengths Summary</div>
            <div className={styles.resultsGrid}>
              {scoreBreakdown.sorted.map((profile) => (
                <div key={profile.key} className={styles.resultCard}>
                  <div className={styles.resultTitle}>{profile.label}</div>
                  <div>{profile.value} responses</div>
                  <div>{profile.percent}%</div>
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
