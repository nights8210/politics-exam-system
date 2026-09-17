import Link from "next/link";
import { ArrowRight, BookOpenCheck, CircleAlert, ClipboardCheck, Target } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeading } from "@/components/page-heading";

export const metadata={ title:"学习概览" };
export default async function DashboardPage(){
  const user=await requireUser();
  const [attemptCount,wrongCount,questionCount,recent]=await Promise.all([
    db.examAttempt.count({where:{userId:user.id,status:"SUBMITTED"}}),
    db.wrongQuestion.count({where:{userId:user.id,mastered:false}}),
    db.question.count({where:{isActive:true,deletedAt:null,reviewStatus:"PUBLISHED"}}),
    db.examAttempt.findMany({where:{userId:user.id},orderBy:{startedAt:"desc"},take:5,include:{exam:{select:{title:true}}}}),
  ]);
  const aggregate=await db.examAttempt.aggregate({where:{userId:user.id,status:"SUBMITTED"},_avg:{accuracy:true}});
  const stats=[{label:"已完成考试",value:attemptCount,unit:"次",icon:ClipboardCheck},{label:"平均准确率",value:Number(aggregate._avg.accuracy??0).toFixed(1),unit:"%",icon:Target},{label:"待复习错题",value:wrongCount,unit:"题",icon:CircleAlert},{label:"正式题库",value:questionCount,unit:"题",icon:BookOpenCheck}];
  return <><PageHeading title={`晚上好，${user.name||"同学"}`} description="先看薄弱点，再开始一次有针对性的练习。" action={<Link href="/exams/generate" className="btn-primary">生成随机试卷 <ArrowRight size={18}/></Link>}/><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({label,value,unit,icon:Icon})=><article className="card p-5" key={label}><div className="mb-5 grid size-10 place-items-center rounded-xl bg-red-50 text-[#b4232d]"><Icon size={21}/></div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold text-slate-900">{value}<span className="ml-1 text-sm font-medium text-slate-500">{unit}</span></p></article>)}</section><section className="card mt-6 overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-semibold text-slate-900">最近考试</h2><p className="mt-1 text-sm text-slate-500">查看最近的得分与完成状态</p></div><Link href="/attempts" className="text-sm font-semibold text-[#b4232d]">全部记录</Link></div>{recent.length===0?<div className="p-10 text-center"><p className="font-medium text-slate-700">还没有考试记录</p><p className="mt-2 text-sm text-slate-500">题库发布后即可生成第一份随机试卷。</p></div>:<div className="divide-y divide-slate-100">{recent.map(item=><div key={item.id} className="grid gap-2 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-medium">{item.exam.title}</p><p className="text-sm text-slate-500">{item.startedAt.toLocaleDateString("zh-CN")}</p></div><p className="text-sm">{Number(item.score)}/{Number(item.totalScore)} 分</p><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{item.status}</span></div>)}</div>}</section></>;
}
