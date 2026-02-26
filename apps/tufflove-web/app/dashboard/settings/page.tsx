import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { deleteMyAccountAction } from "@/app/actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/join");

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "0 auto", color: "#333", paddingTop: "50px" }}>
      <h1>⚙️ Account Settings</h1>
      
      <div style={{ backgroundColor: "white", padding: "30px", borderRadius: "12px", border: "1px solid #e5e5e5", marginTop: "30px" }}>
         <h3 style={{ color: "#dc2626", marginTop: 0 }}>⚠️ Danger Zone</h3>
         <p style={{ color: "#666" }}>
           Permanently delete your account and sign out. This action cannot be undone.
         </p>
         
         <form action={deleteMyAccountAction}>
            <button style={{ backgroundColor: "#fee2e2", color: "#dc2626", border: "1px solid #dc2626", padding: "12px 20px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>
              Delete My Account
            </button>
         </form>
      </div>
    </div>
  );
}
