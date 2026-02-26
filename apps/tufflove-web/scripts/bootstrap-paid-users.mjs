import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const defaultPassword = "4TuffLove2026!";
const users = [
  "moe@beteachable.com",
  "zak@beteachable.com",
  "cathy@beteachable.com",
  "masterprogrammer@hotmail.com",
].map((email) => ({
  email,
  password: defaultPassword,
}));

const loadUsers = async () => {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (error) {
    throw error;
  }
  return data?.users ?? [];
};

const run = async () => {
  const existingUsers = await loadUsers();
  const byEmail = new Map(
    existingUsers
      .filter((user) => user.email)
      .map((user) => [user.email.toLowerCase(), user])
  );

  for (const user of users) {
    const existing = byEmail.get(user.email.toLowerCase());
    if (existing) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        password: user.password,
        email_confirm: true,
        app_metadata: {
          ...existing.app_metadata,
          is_paid: true,
        },
      });

      if (error) {
        console.error(`Failed to update ${user.email}:`, error.message);
      } else {
        console.log(`Updated ${user.email} (paid + password set).`);
      }
      continue;
    }

    const { error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      app_metadata: {
        is_paid: true,
      },
    });

    if (error) {
      console.error(`Failed to create ${user.email}:`, error.message);
    } else {
      console.log(`Created ${user.email} (paid + password set).`);
    }
  }
};

run().catch((error) => {
  console.error("Bootstrap failed:", error);
  process.exit(1);
});
