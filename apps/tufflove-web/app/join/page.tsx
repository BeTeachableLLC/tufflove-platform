import { signInWithInvite } from "./actions"; // Import the trigger
import { redirect } from "next/navigation";

type SearchParams = Promise<{
  workspace_id?: string;
  seat_id?: string;
  email?: string;
  code?: string;
  access_token?: string;
  refresh_token?: string;
  type?: string;
  next?: string;
  redirect_to?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
}>;

export default async function JoinPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const { workspace_id, seat_id, email } = searchParams;
  const authParams = ["code", "access_token", "refresh_token", "type", "next", "redirect_to"];
  const hasAuthParams = authParams.some((key) => Boolean(searchParams[key as keyof typeof searchParams]));
  const errorDescription = searchParams.error_description || searchParams.error_code || searchParams.error;
  const hasAuthError = Boolean(errorDescription);

  if (hasAuthParams) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams)) {
      if (!value) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          params.append(key, item);
        }
      } else {
        params.append(key, value);
      }
    }

    const query = params.toString();
    redirect(`/auth/callback${query ? `?${query}` : ""}`);
  }

  if (hasAuthError) {
    const message = Array.isArray(errorDescription)
      ? errorDescription[0]
      : errorDescription;
    const encoded = encodeURIComponent(message || "Sign-in failed");
    redirect(`/sign-in?error=${encoded}`);
  }

  if (!workspace_id || !seat_id || !email) {
    return (
      <div style={{ padding: "50px", textAlign: "center", fontFamily: "sans-serif" }}>
        <h1>Invalid Invite Link</h1>
        <p>This link is missing required information.</p>
        <p>
          If you meant to sign in, go to <a href="/sign-in">/sign-in</a>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "50px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>You are invited!</h1>
      <p><strong>Workspace ID:</strong> {workspace_id}</p>
      <p><strong>Email:</strong> {email}</p>
      
      {/* The Form connects the UI to the Server Action */}
      <div style={{ marginTop: "20px" }}>
        <form action={signInWithInvite}>
          {/* We hide the email in a hidden input so it gets sent with the form */}
          <input type="hidden" name="email" value={email} />
          
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              fontSize: "16px",
              backgroundColor: "black",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Accept Invite & Login
          </button>
        </form>
      </div>
    </div>
  );
}
