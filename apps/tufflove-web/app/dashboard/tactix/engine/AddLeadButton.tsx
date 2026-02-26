"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLeadAction } from "@/app/actions";

export default function AddLeadButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleClick = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const result = await createLeadAction();
      if (result?.error) {
        if (result.error === "Unauthorized") {
          router.push("/join");
          return;
        }
        alert(result.error);
        return;
      }
      if (result?.leadId) {
        router.push(`/dashboard/leads/${result.leadId}`);
      } else {
        alert("Lead created, but no ID was returned.");
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to create lead.";
      alert(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isCreating}
      style={{
        backgroundColor: "#000",
        color: "#fff",
        padding: "12px 24px",
        borderRadius: "8px",
        border: "none",
        cursor: "pointer",
        fontWeight: "bold",
        fontSize: "14px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        opacity: isCreating ? 0.7 : 1,
      }}
    >
      {isCreating ? "Creating..." : "+ Add New Lead"}
    </button>
  );
}
