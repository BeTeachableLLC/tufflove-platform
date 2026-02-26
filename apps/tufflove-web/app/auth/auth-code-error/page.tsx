export default function AuthCodeErrorPage() {
  return (
    <main style={{ padding: "48px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>Sign-in link failed</h1>
      <p>The sign-in link is invalid, expired, or was already used.</p>
      <p>Please request a new link and try again.</p>
      <p>
        Go to <a href="/sign-in">/sign-in</a> to try again.
      </p>
      <p>
        If this keeps happening, double-check your Supabase Auth redirect URLs and
        Vercel environment variables, then redeploy.
      </p>
    </main>
  );
}
