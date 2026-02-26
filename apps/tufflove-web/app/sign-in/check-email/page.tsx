type SearchParams = Promise<{
  email?: string;
}>;

export default async function SignInCheckEmailPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const { email } = searchParams;
  const displayEmail = email ? decodeURIComponent(email) : "your email";

  return (
    <div style={{ padding: "50px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>Check your inbox</h1>
      <p>We sent a confirmation email to {displayEmail}.</p>
      <p>Open the link to finish setting up your account.</p>
    </div>
  );
}
