export const REQUIRED_DNA_FIELDS = [
  "core_promise",
  "voice_rules",
  "audience",
  "offers",
  "scoreboard",
] as const;

export const DNA_FIELD_LABELS: Record<string, string> = {
  core_promise: "Core promise",
  voice_rules: "Voice rules & tone",
  audience: "Audience DNA",
  offers: "Offers & outcomes",
  scoreboard: "Scoreboard or KPIs",
  non_negotiables: "Non-negotiables & standards",
  dna_text: "DNA summary",
  brain_text: "Brain notes",
  notes: "Additional notes",
};

export type DnaProfileInput = Record<string, string | null | undefined>;

export function getMissingDnaFields(profile: DnaProfileInput = {}) {
  return REQUIRED_DNA_FIELDS.filter((field) => {
    const value = profile[field];
    return !value || !String(value).trim();
  });
}

export function getDnaCompletion(profile: DnaProfileInput = {}) {
  const total = Number(REQUIRED_DNA_FIELDS.length);
  const missing = getMissingDnaFields(profile).length;
  const completed = total - missing;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, percent };
}

export function formatMissingFields(fields: string[]) {
  return fields.map((field) => DNA_FIELD_LABELS[field] || field);
}
