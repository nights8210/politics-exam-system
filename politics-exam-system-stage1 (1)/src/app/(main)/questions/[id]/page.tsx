import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { QuestionForm } from "@/components/questions/question-form";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
export default async function EditQuestionPage({params}:{params:Promise<{id:string}>}){ await requireAdmin(); const {id}=await params; const q=await db.question.findFirst({where:{id,deletedAt:null}}); if(!q)notFound(); return <><PageHeading title="编辑题目" description="修改不会影响已经生成的历史试卷快照。"/><QuestionForm initial={{id:q.id,type:q.type,stem:q.stem,options:q.options as {id:string;text:string}[]|null,answer:q.answer as Record<string,unknown>,explanation:q.explanation,chapter:q.chapter,knowledgePoint:q.knowledgePoint,difficulty:q.difficulty,defaultScore:Number(q.defaultScore),sourcePdf:q.sourcePdf,reviewStatus:q.reviewStatus}}/></>; }
