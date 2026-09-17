import { z } from "zod";

const optionSchema=z.object({ id:z.string().min(1).max(10),text:z.string().min(1).max(2000) });
export const questionSchema=z.object({
  type:z.enum(["SINGLE_CHOICE","MULTIPLE_CHOICE","TRUE_FALSE","SHORT_ANSWER","MATERIAL_ANALYSIS"]),
  stem:z.string().trim().min(2).max(20000),
  options:z.array(optionSchema).max(20).nullable().optional(),
  answer:z.record(z.string(),z.unknown()),
  explanation:z.string().trim().max(30000).nullable().optional(),
  chapter:z.string().trim().max(200).nullable().optional(),
  knowledgePoint:z.string().trim().max(200).nullable().optional(),
  difficulty:z.enum(["EASY","MEDIUM","HARD"]),
  defaultScore:z.coerce.number().positive().max(100),
  sourcePdf:z.string().trim().max(500).nullable().optional(),
  reviewStatus:z.enum(["PENDING_REVIEW","REVIEWED","PUBLISHED"]).default("PUBLISHED"),
});

export type QuestionInput=z.infer<typeof questionSchema>;
