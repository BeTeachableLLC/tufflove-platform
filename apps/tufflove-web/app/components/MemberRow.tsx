"use client";

import { toggleAssignmentAction, deleteMemberAction } from "@/app/actions";
import { useState } from "react";
import Link from "next/link"; // Import Link

type TeamMember = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

type Company = {
  id: string;
  name: string;
};

type Assignment = {
  member_id: string;
  company_id: string;
};

export default function MemberRow({
  member,
  companies,
  assignments,
}: {
  member: TeamMember;
  companies: Company[];
  assignments: Assignment[];
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const checkAssignment = (companyId: string) => {
    return assignments.some((a) => a.member_id === member.id && a.company_id === companyId);
  };

  const handleDelete = async () => {
    if(!confirm("Are you sure you want to remove this user?")) return;
    setIsDeleting(true);
    await deleteMemberAction(member.id);
  };

  // Determine display name
  const displayName = member.first_name && member.last_name 
    ? `${member.first_name} ${member.last_name}` 
    : member.email;

  return (
    <tr style={{ borderBottom: "1px solid #eee" }}>
      
      {/* 1. NAME / EMAIL (CLICKABLE) */}
      <td style={{ padding: "15px", fontWeight: "500", color: "#333" }}>
        <Link href={`/dashboard/the-unit/${member.id}`} style={{ textDecoration: "none", color: "#2563eb", fontWeight: "bold" }}>
            {displayName}
        </Link>
        {member.first_name && (
            <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{member.email}</div>
        )}
      </td>
      
      {/* 2. COMPANY GRID */}
      <td style={{ padding: "15px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          {companies.map((company) => {
            const isAssigned = checkAssignment(company.id);
            return (
              <button
                key={company.id}
                onClick={() => toggleAssignmentAction(member.id, company.id, isAssigned)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  border: isAssigned ? "1px solid #166534" : "1px solid #ddd",
                  backgroundColor: isAssigned ? "#dcfce7" : "white",
                  color: isAssigned ? "#166534" : "#999",
                  transition: "all 0.2s"
                }}
              >
                {isAssigned ? "✓ " : "+ "}
                {company.name}
              </button>
            );
          })}
        </div>
      </td>

      {/* 3. DELETE BUTTON */}
      <td style={{ padding: "15px", textAlign: "right" }}>
        <button 
            onClick={handleDelete}
            disabled={isDeleting}
            style={{ color: "red", background: "none", border: "none", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}
        >
            {isDeleting ? "..." : "Remove"}
        </button>
      </td>
    </tr>
  );
}
