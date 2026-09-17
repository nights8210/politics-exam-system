import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
export const metadata = { title:"注册" };
export default function RegisterPage() { return <div className="w-full max-w-md"><h2 className="text-3xl font-bold text-slate-900">创建账号</h2><p className="mt-2 text-slate-500">一个账号即可在手机和电脑上使用。</p><div className="mt-8"><AuthForm mode="register"/></div><p className="mt-6 text-center text-sm text-slate-600">已有账号？ <Link className="font-semibold text-[#b4232d]" href="/login">返回登录</Link></p></div>; }
