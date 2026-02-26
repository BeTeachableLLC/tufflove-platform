import Link from "next/link";
import { formatMissingFields } from "@/lib/dna";

export default function DnaWarningBanner({
  missingFields,
  title = "Complete your DNA",
  description,
  ctaHref = "/dashboard/the-code",
  ctaLabel = "Update DNA →",
}: {
  missingFields: string[];
  title?: string;
  description?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  if (!missingFields || missingFields.length === 0) return null;

  const missingLabels = formatMissingFields(missingFields).join(", ");
  const message = description || `Missing: ${missingLabels}.`;

  return (
    <div
      style={{
        backgroundColor: "#FEF3C7",
        border: "1px solid #FDE68A",
        color: "#92400E",
        padding: "12px 16px",
        borderRadius: "12px",
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        fontSize: "13px",
      }}
    >
      <div>
        <div style={{ fontWeight: 700, marginBottom: "4px" }}>{title}</div>
        <div>{message}</div>
      </div>
      <Link
        href={ctaHref}
        style={{
          color: "#92400E",
          fontWeight: 700,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
