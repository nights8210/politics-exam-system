import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function adminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return null;

  const email = data.user.email.toLowerCase();
  const role = adminEmails().has(email) ? "ADMIN" : "USER";
  return db.user.upsert({
    where: { authId: data.user.id },
    update: { email, name: data.user.user_metadata?.name ?? null, role },
    create: {
      authId: data.user.id,
      email,
      name: data.user.user_metadata?.name ?? null,
      role,
    },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user || !user.isActive) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}
