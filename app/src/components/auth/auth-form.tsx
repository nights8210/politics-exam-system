"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    setLoading(true); setMessage("");
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const supabase = createSupabaseBrowserClient();
    if (mode === "register") {
      const { error } = await supabase.auth.signUp({ email, password, options: { data:{ name }, emailRedirectTo:`${location.origin}/auth/confirm` } });
      setLoading(false); setMessage(error ? error.message : "注册成功，请检查邮箱并完成验证。"); return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setMessage("登录失败，请检查邮箱和密码。");
    router.replace("/dashboard"); router.refresh();
  }
  return <form action={submit} className="space-y-4">
    {mode === "register" && <label className="block text-sm font-medium text-slate-700">姓名<input className="field mt-1.5" name="name" autoComplete="name" required /></label>}
    <label className="block text-sm font-medium text-slate-700">邮箱<input className="field mt-1.5" name="email" type="email" autoComplete="email" required /></label>
    <label className="block text-sm font-medium text-slate-700">密码<input className="field mt-1.5" name="password" type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>
    {message && <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
    <button className="btn-primary w-full" disabled={loading}>{loading ? "处理中…" : mode === "login" ? "登录" : "创建账号"}</button>
  </form>;
}
