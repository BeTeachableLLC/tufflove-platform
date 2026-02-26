import { signInWithPassword, signUpWithPassword } from "./actions";
import OAuthButtons from "./OAuthButtons";

type SearchParams = Promise<{
  error?: string;
  email?: string;
}>;

export default async function SignInPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const { error, email } = searchParams;
  const errorMessage = error ? decodeURIComponent(error) : "";

  return (
    <div style={{ padding: "50px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>Sign in</h1>
      <p>Use your email and password to access your command center.</p>
      {errorMessage ? (
        <p style={{ color: "red" }}>{errorMessage}</p>
      ) : null}
      <div style={{ marginTop: "20px" }}>
        <form action={signInWithPassword}>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            defaultValue={email || ""}
            required
            style={{
              padding: "10px",
              fontSize: "16px",
              width: "280px",
              maxWidth: "80%",
              marginRight: "10px",
            }}
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            style={{
              padding: "10px",
              fontSize: "16px",
              width: "280px",
              maxWidth: "80%",
              marginTop: "10px",
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          />
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
              marginTop: "12px",
            }}
          >
            Sign in
          </button>
        </form>
      </div>
      <OAuthButtons />
      <p style={{ marginTop: "16px", color: "#666" }}>
        Yahoo accounts can use email + password sign in.
      </p>
      <div style={{ marginTop: "36px" }}>
        <h2>Create account</h2>
        <p>Set a password for your TUFF LOVE operator profile.</p>
        <form action={signUpWithPassword}>
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            defaultValue={email || ""}
            required
            style={{
              padding: "10px",
              fontSize: "16px",
              width: "280px",
              maxWidth: "80%",
              marginRight: "10px",
            }}
          />
          <input
            type="password"
            name="password"
            placeholder="Create a password (min 6 characters)"
            required
            minLength={6}
            style={{
              padding: "10px",
              fontSize: "16px",
              width: "280px",
              maxWidth: "80%",
              marginTop: "10px",
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          />
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
              marginTop: "12px",
            }}
          >
            Create account
          </button>
        </form>
      </div>
      <p style={{ marginTop: "24px" }}>Have an invite? Use your invite link.</p>
    </div>
  );
}
