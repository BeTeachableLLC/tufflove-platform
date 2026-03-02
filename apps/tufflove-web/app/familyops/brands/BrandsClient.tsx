"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Brand = {
  id: string;
  tenant_id: string;
  name: string;
  ghl_location_id: string | null;
  timezone: string;
  default_platforms: string[];
  status: "active" | "inactive";
  created_at: string | null;
  updated_at: string | null;
};

type EditableBrand = {
  ghl_location_id: string;
  timezone: string;
  default_platforms: string;
  status: "active" | "inactive";
};

function parseError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
  }
  return fallback;
}

async function readResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }
  return response.text();
}

function platformsToString(platforms: string[]): string {
  return platforms.join(", ");
}

function platformsFromString(input: string): string[] {
  return input
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function BrandsClient() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [forms, setForms] = useState<Record<string, EditableBrand>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingBrandId, setSavingBrandId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await fetch("/api/familyops/brands", { cache: "no-store" });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to load brands (${response.status})`));
      }
      const list =
        payload && typeof payload === "object" && Array.isArray((payload as { brands?: unknown[] }).brands)
          ? ((payload as { brands: Brand[] }).brands || [])
          : [];
      setBrands(list);
      const nextForms: Record<string, EditableBrand> = {};
      for (const brand of list) {
        nextForms[brand.id] = {
          ghl_location_id: brand.ghl_location_id || "",
          timezone: brand.timezone || "America/New_York",
          default_platforms: platformsToString(brand.default_platforms || []),
          status: brand.status || "active",
        };
      }
      setForms(nextForms);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBrands([]);
      setForms({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  const connectedCount = useMemo(
    () => brands.filter((b) => b.status === "active" && Boolean(b.ghl_location_id)).length,
    [brands],
  );

  function updateForm(brandId: string, patch: Partial<EditableBrand>) {
    setForms((prev) => {
      const current = prev[brandId];
      if (!current) return prev;
      return { ...prev, [brandId]: { ...current, ...patch } };
    });
  }

  async function saveBrand(brandId: string) {
    const form = forms[brandId];
    if (!form) return;
    setSavingBrandId(brandId);
    setSaveMessage(null);
    setError(null);
    try {
      const response = await fetch(`/api/familyops/brand/${encodeURIComponent(brandId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ghl_location_id: form.ghl_location_id.trim() || null,
          timezone: form.timezone.trim() || "America/New_York",
          default_platforms: platformsFromString(form.default_platforms),
          status: form.status,
        }),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        throw new Error(parseError(payload, `Failed to save brand (${response.status})`));
      }
      setSaveMessage(`Saved ${brandId}`);
      await loadBrands();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingBrandId(null);
    }
  }

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>FamilyOps Brand Registry</h1>
      <p style={{ color: "#9ca3af", marginBottom: 10 }}>
        Map each FamilyOps brand to a GHL location (subaccount) and defaults used by publish dry-runs.
      </p>
      <p style={{ marginBottom: 16 }}>
        <Link href="/familyops/approvals" style={{ textDecoration: "underline" }}>
          FamilyOps Approvals
        </Link>
        {" · "}
        <Link href="/familyops/ghl" style={{ textDecoration: "underline" }}>
          FamilyOps GHL
        </Link>
      </p>
      <div style={{ marginBottom: 12, color: "#9ca3af" }}>
        Connected active brands: {connectedCount}/{brands.length}
      </div>
      {error ? <div style={{ color: "#ef4444", marginBottom: 12, fontWeight: 600 }}>{error}</div> : null}
      {saveMessage ? <div style={{ color: "#16a34a", marginBottom: 12, fontWeight: 600 }}>{saveMessage}</div> : null}
      <button
        type="button"
        onClick={() => void loadBrands()}
        disabled={loading}
        style={{ marginBottom: 16, padding: "8px 12px" }}
      >
        {loading ? "Refreshing..." : "Refresh"}
      </button>

      <div style={{ overflowX: "auto", border: "1px solid #333", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Brand</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Location ID</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Timezone</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Default Platforms</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Status</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #333", padding: "8px 6px" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => {
              const form = forms[brand.id];
              if (!form) return null;
              return (
                <tr key={brand.id}>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                    <div style={{ fontWeight: 600 }}>{brand.name}</div>
                    <div style={{ color: "#9ca3af", fontSize: 12 }}>{brand.id}</div>
                  </td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                    <input
                      value={form.ghl_location_id}
                      onChange={(e) => updateForm(brand.id, { ghl_location_id: e.target.value })}
                      placeholder="location id"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                    <input
                      value={form.timezone}
                      onChange={(e) => updateForm(brand.id, { timezone: e.target.value })}
                      style={{ width: "100%", padding: 8 }}
                    />
                  </td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                    <input
                      value={form.default_platforms}
                      onChange={(e) => updateForm(brand.id, { default_platforms: e.target.value })}
                      placeholder="fb, ig"
                      style={{ width: "100%", padding: 8 }}
                    />
                  </td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        updateForm(brand.id, { status: e.target.value as "active" | "inactive" })
                      }
                      style={{ width: "100%", padding: 8 }}
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                  </td>
                  <td style={{ borderBottom: "1px solid #222", padding: "8px 6px" }}>
                    <button
                      type="button"
                      onClick={() => void saveBrand(brand.id)}
                      disabled={savingBrandId === brand.id}
                      style={{ padding: "8px 12px" }}
                    >
                      {savingBrandId === brand.id ? "Saving..." : "Save"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
