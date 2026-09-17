import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
export const metadata = { title:"登录" };
export default function LoginPage() { return <div className="w-full max-w-md"><div className="mb-8 lg:hidden"><span className="rounded-xl bg-[#14243a] px-3 py-2 font-semibold text-white">政治考试系统</span></div><h2 className="text-3xl font-bold text-slate-900">欢迎回来</h2><p className="mt-2 text-slate-500">登录后继续答题，并同步手机与电脑的进度。</p><div className="mt-8"><AuthForm mode="login"/></div><p className="mt-6 text-center text-sm text-slate-600">还没有账号？ <Link className="font-semibold text-[#b4232d]" href="/register">注册</Link></p></div>; }
