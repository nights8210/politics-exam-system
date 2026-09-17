"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, BookOpenCheck, CircleUserRound, FileUp, History, LayoutDashboard, LogOut, Menu, Settings, X } from "lucide-react";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const nav = [
  ["/dashboard", "学习概览", LayoutDashboard],
  ["/questions", "题库管理", BookOpenCheck],
  ["/imports", "PDF 导入", FileUp],
  ["/attempts", "考试记录", History],
  ["/stats", "学习统计", BarChart3],
  ["/settings", "设置", Settings],
] as const;

export function AppShell({ children, user }: { children:React.ReactNode; user:{ name:string|null; email:string; role:string } }) {
  const pathname=usePathname(); const router=useRouter(); const [open,setOpen]=useState(false);
  async function signOut(){ await createSupabaseBrowserClient().auth.signOut(); router.replace("/login"); router.refresh(); }
  const sidebar=<><div className="flex h-18 items-center gap-3 border-b border-white/10 px-5"><span className="grid size-9 place-items-center rounded-xl bg-[#b4232d] font-bold">政</span><div><p className="font-semibold">政治考试系统</p><p className="text-xs text-slate-400">成人高考题库</p></div></div><nav className="flex-1 space-y-1 p-3">{nav.map(([href,label,Icon])=><Link key={href} href={href} onClick={()=>setOpen(false)} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",pathname.startsWith(href)?"bg-white/12 text-white":"text-slate-300 hover:bg-white/7 hover:text-white")}><Icon size={19}/>{label}</Link>)}</nav><div className="border-t border-white/10 p-3"><div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2"><CircleUserRound size={20}/><div className="min-w-0"><p className="truncate text-sm font-medium">{user.name||user.email}</p><p className="text-xs text-slate-400">{user.role==="ADMIN"?"管理员":"学习用户"}</p></div></div><button onClick={signOut} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-slate-300 hover:bg-white/7"><LogOut size={19}/>退出登录</button></div></>;
  return <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]"><aside className="desktop-only fixed inset-y-0 left-0 w-60 bg-[#14243a] text-white md:flex md:flex-col">{sidebar}</aside>{open&&<div className="fixed inset-0 z-50 flex md:hidden"><button className="absolute inset-0 bg-black/45" aria-label="关闭菜单" onClick={()=>setOpen(false)}/><aside className="relative flex w-[82%] max-w-xs flex-col bg-[#14243a] text-white">{sidebar}<button onClick={()=>setOpen(false)} className="absolute right-3 top-4 rounded-lg p-2"><X/></button></aside></div>}<div className="min-w-0 md:col-start-2"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-8"><button className="rounded-lg p-2 md:hidden" onClick={()=>setOpen(true)} aria-label="打开菜单"><Menu/></button><p className="hidden text-sm text-slate-500 md:block">把练习结果变成下一次进步的依据</p><div className="text-right"><p className="text-sm font-medium text-slate-800">{user.name||"学习用户"}</p><p className="text-xs text-slate-500">数据已云端同步</p></div></header><main className="mx-auto max-w-[1400px] p-4 md:p-8">{children}</main></div></div>;
}
