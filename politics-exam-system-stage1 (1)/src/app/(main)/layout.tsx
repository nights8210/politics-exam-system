import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
export const dynamic="force-dynamic";
export default async function MainLayout({ children }:{ children:ReactNode }) { const user=await requireUser(); return <AppShell user={{name:user.name,email:user.email,role:user.role}}>{children}</AppShell>; }
