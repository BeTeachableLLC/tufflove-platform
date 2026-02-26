"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

const providers = [
  { id: "google", label: "Continue with Google" },
  { id: "apple", label: "Continue with Apple" },
  { id: "azure", label: "Continue with Microsoft (Outlook/Hotmail/MSN)" },
] as const;

type ProviderId = (typeof providers)[number]["id"];

export default function OAuthButtons() {
  const [loadingProvider, setLoadingProvider] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuth = async (provider: ProviderId) => {
    setError(null);
    setLoadingProvider(provider);
    const supabase = createClient();
    const origin = typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL;

    const redirectTo = origin
      ? `${origin}/auth/callback?provider=${provider}&next=/dashboard`
      : undefined;

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });

    if (authError) {
      console.error("OAuth sign-in error:", authError);
      setError(authError.message || "Could not sign in with provider");
      setLoadingProvider(null);
    }
  };

  return (
    <div style={{ marginTop: "28px" }}>
      <p style={{ marginBottom: "12px" }}>Paid accounts can also use:</p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          alignItems: "center",
        }}
      >
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => handleOAuth(provider.id)}
            disabled={Boolean(loadingProvider)}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              backgroundColor: "#111",
              color: "white",
              border: "1px solid #333",
              borderRadius: "6px",
              cursor: loadingProvider ? "not-allowed" : "pointer",
              minWidth: "240px",
            }}
          >
            {loadingProvider === provider.id ? "Redirecting..." : provider.label}
          </button>
        ))}
      </div>
      {error ? <p style={{ color: "red", marginTop: "12px" }}>{error}</p> : null}
    </div>
  );
}
