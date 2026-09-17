"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial={ id:string;type:string;stem:string;options:{id:string;text:string}[]|null;answer:Record<string,unknown>;explanation:string|null;chapter:string|null;knowledgePoint:string|null;difficulty:string;defaultScore:number;sourcePdf:string|null;reviewStatus:string };
function answerText(answer:Record<string,unknown>){ const ids=answer.optionIds; if(Array.isArray(ids)) return ids.join(","); if(typeof answer.value==="boolean") return answer.value?"正确":"错误"; const words=answer.keywords; return Array.isArray(words)?words.join(","):""; }

export function QuestionForm({ initial }:{ initial?:Initial }){
  const router=useRouter(); const [type,setType]=useState(initial?.type??"SINGLE_CHOICE"); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function submit(data:FormData){
    setBusy(true); setError("");
    const answerRaw=String(data.get("answer")??"").trim();
    const optionsRaw=String(data.get("options")??"");
    const options=optionsRaw.split("\n").map(line=>line.trim()).filter(Boolean).map((line,index)=>{ const match=line.match(/^([A-Za-z0-9]+)[\.、:：]\s*(.+)$/); return match?{id:match[1].toUpperCase(),text:match[2]}:{id:String.fromCharCode(65+index),text:line}; });
    const answer=type==="TRUE_FALSE"?{value:["正确","true","对"].includes(answerRaw.toLowerCase())}:type==="SHORT_ANSWER"||type==="MATERIAL_ANALYSIS"?{keywords:answerRaw.split(/[,，]/).map(x=>x.trim()).filter(Boolean)}:{optionIds:answerRaw.split(/[,，]/).map(x=>x.trim().toUpperCase()).filter(Boolean)};
    const body={type,stem:data.get("stem"),options:["SINGLE_CHOICE","MULTIPLE_CHOICE"].includes(type)?options:null,answer,explanation:data.get("explanation")||null,chapter:data.get("chapter")||null,knowledgePoint:data.get("knowledgePoint")||null,difficulty:data.get("difficulty"),defaultScore:Number(data.get("defaultScore")),sourcePdf:data.get("sourcePdf")||null,reviewStatus:data.get("reviewStatus")};
    const response=await fetch(initial?`/api/questions/${initial.id}`:"/api/questions",{method:initial?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json(); setBusy(false);
    if(!response.ok) return setError(result.error??"保存失败");
    router.push("/questions"); router.refresh();
  }
  const optionsText=initial?.options?.map(o=>`${o.id}. ${o.text}`).join("\n")??"A. \nB. \nC. \nD. ";
  return <form action={submit} className="card space-y-5 p-5 md:p-7">
    <div className="grid gap-5 md:grid-cols-3"><label className="text-sm font-medium">题型<select name="type" className="field mt-1.5" value={type} onChange={e=>setType(e.target.value)}><option value="SINGLE_CHOICE">单选题</option><option value="MULTIPLE_CHOICE">多选题</option><option value="TRUE_FALSE">判断题</option><option value="SHORT_ANSWER">简答题</option><option value="MATERIAL_ANALYSIS">材料分析</option></select></label><label className="text-sm font-medium">难度<select name="difficulty" defaultValue={initial?.difficulty??"MEDIUM"} className="field mt-1.5"><option value="EASY">简单</option><option value="MEDIUM">中等</option><option value="HARD">困难</option></select></label><label className="text-sm font-medium">分值<input name="defaultScore" type="number" min="0.5" step="0.5" defaultValue={initial?.defaultScore??2} className="field mt-1.5" required/></label></div>
    <label className="block text-sm font-medium">题干<textarea name="stem" rows={5} defaultValue={initial?.stem} className="field mt-1.5" required/></label>
    {["SINGLE_CHOICE","MULTIPLE_CHOICE"].includes(type)&&<label className="block text-sm font-medium">选项（每行一个，如“A. 内容”）<textarea name="options" rows={6} defaultValue={optionsText} className="field mt-1.5 font-mono" required/></label>}
    <label className="block text-sm font-medium">正确答案<span className="ml-2 font-normal text-slate-500">{type==="MULTIPLE_CHOICE"?"多个答案用逗号分隔":type==="TRUE_FALSE"?"填写“正确”或“错误”":type.includes("ANSWER")||type==="MATERIAL_ANALYSIS"?"关键词用逗号分隔":"填写选项字母"}</span><input name="answer" defaultValue={initial?answerText(initial.answer):""} className="field mt-1.5" required/></label>
    <label className="block text-sm font-medium">解析<textarea name="explanation" rows={4} defaultValue={initial?.explanation??""} className="field mt-1.5"/></label>
    <div className="grid gap-5 md:grid-cols-2"><label className="text-sm font-medium">章节<input name="chapter" defaultValue={initial?.chapter??""} className="field mt-1.5"/></label><label className="text-sm font-medium">知识点<input name="knowledgePoint" defaultValue={initial?.knowledgePoint??""} className="field mt-1.5"/></label><label className="text-sm font-medium">来源 PDF<input name="sourcePdf" defaultValue={initial?.sourcePdf??""} className="field mt-1.5"/></label><label className="text-sm font-medium">状态<select name="reviewStatus" defaultValue={initial?.reviewStatus??"PUBLISHED"} className="field mt-1.5"><option value="PENDING_REVIEW">待校对</option><option value="REVIEWED">已校对</option><option value="PUBLISHED">已发布</option></select></label></div>
    {error&&<p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={()=>router.back()}>取消</button><button className="btn-primary" disabled={busy}>{busy?"保存中…":"保存题目"}</button></div>
  </form>;
}
