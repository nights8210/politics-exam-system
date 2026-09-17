"use client";
import { FileText, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function UploadPdfForm(){
  const router=useRouter(); const input=useRef<HTMLInputElement>(null); const [file,setFile]=useState<File|null>(null); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  async function upload(){ if(!file)return; setBusy(true); setMessage(""); const body=new FormData(); body.set("file",file); const res=await fetch("/api/import/pdf",{method:"POST",body}); const result=await res.json(); setBusy(false); if(!res.ok)return setMessage(result.error??"上传失败"); setFile(null); if(input.current)input.current.value=""; setMessage(result.requiresOcr?"上传完成。文件需要中文 OCR，已进入待处理队列。":"上传完成，已提取文字并进入结构化队列。"); router.refresh(); }
  return <div className="card p-5 md:p-6"><button type="button" onClick={()=>input.current?.click()} className="flex min-h-48 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 text-center transition hover:border-[#b4232d] hover:bg-red-50/40"><UploadCloud className="mb-3 text-[#b4232d]" size={34}/><span className="font-semibold text-slate-800">选择 PDF 文件</span><span className="mt-1 text-sm text-slate-500">仅支持 PDF，单个文件最大 20MB</span></button><input ref={input} hidden type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]??null)}/>{file&&<div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"><FileText className="text-[#b4232d]"/><div className="min-w-0 flex-1"><p className="truncate font-medium">{file.name}</p><p className="text-sm text-slate-500">{(file.size/1024/1024).toFixed(2)} MB</p></div><button onClick={upload} disabled={busy} className="btn-primary">{busy?"正在检查…":"上传并检查"}</button></div>}{message&&<p className="mt-4 rounded-xl bg-slate-100 p-4 text-sm text-slate-700">{message}</p>}</div>;
}
