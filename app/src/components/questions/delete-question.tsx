"use client";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
export function DeleteQuestion({ id }:{id:string}){ const router=useRouter(); const [busy,setBusy]=useState(false); async function remove(){ if(!confirm("确定停用这道题吗？历史试卷不会受影响。"))return; setBusy(true); const res=await fetch(`/api/questions/${id}`,{method:"DELETE"}); setBusy(false); if(res.ok)router.refresh(); else alert("删除失败"); } return <button onClick={remove} disabled={busy} title="停用题目" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-700"><Trash2 size={17}/></button>; }
