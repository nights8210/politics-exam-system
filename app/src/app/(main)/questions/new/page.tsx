import { PageHeading } from "@/components/page-heading";
import { QuestionForm } from "@/components/questions/question-form";
import { requireAdmin } from "@/lib/auth";
export default async function NewQuestionPage(){ await requireAdmin(); return <><PageHeading title="新增题目" description="手动录入后可立即发布，或先保存为待校对。"/><QuestionForm/></>; }
