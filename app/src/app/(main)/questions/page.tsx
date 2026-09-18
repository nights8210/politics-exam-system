import Link from "next/link";
import { Pencil, Plus, Search } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { DeleteQuestion } from "@/components/questions/delete-question";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const typeName: Record<string, string> = {
  SINGLE_CHOICE: "单选题",
  MULTIPLE_CHOICE: "多选题",
  TRUE_FALSE: "判断题",
  JUDGMENT: "辨析题",
  SHORT_ANSWER: "简答题",
  MATERIAL_ANALYSIS: "材料分析",
  ESSAY: "论述题",
};

const difficultyName: Record<string, string> = {
  EASY: "简单",
  BASIC: "基础",
  MEDIUM: "中等",
  HARD: "较难",
};

export const metadata = {
  title: "题库管理",
};

function getAnswerText(answer: unknown) {
  if (!answer || typeof answer !== "object") return "—";

  const data = answer as Record<string, unknown>;

  if (typeof data.correct === "string") {
    return data.correct;
  }

  if (typeof data.correct === "boolean") {
    return data.correct ? "正确" : "错误";
  }

  if (typeof data.reference === "string") {
    return "参考答案";
  }

  return "—";
}

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const p = await searchParams;

  const q = p.q?.trim() ?? "";
  const type = p.type ?? "";
  const year = p.year ?? "";

  const baseWhere = {
    deletedAt: null,
    isActive: true,
    reviewStatus: "APPROVED",
  };

  const where = {
    ...baseWhere,

    ...(type
      ? {
          type,
        }
      : {}),

    ...(year
      ? {
          year: Number(year),
        }
      : {}),

    ...(q
      ? {
          OR: [
            {
              stem: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              chapter: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              knowledgePoint: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              sourceTitle: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [
    questions,
    totalCount,
    count2018,
    count2019,
    count2020,
    filteredCount,
  ] = await Promise.all([
    db.question.findMany({
      where,
      orderBy: [
        {
          year: "asc",
        },
        {
          originalQuestionNumber: "asc",
        },
      ],

      // 当前只有137题，先全部显示。
      // 后续题库扩大后再改成分页。
      take: 500,
    }),

    db.question.count({
      where: baseWhere,
    }),

    db.question.count({
      where: {
        ...baseWhere,
        year: 2018,
      },
    }),

    db.question.count({
      where: {
        ...baseWhere,
        year: 2019,
      },
    }),

    db.question.count({
      where: {
        ...baseWhere,
        year: 2020,
      },
    }),

    db.question.count({
      where,
    }),
  ]);

  return (
    <>
      <PageHeading
        title="题库管理"
        description="筛选、校对和维护所有正式题目。"
        action={
          user.role === "ADMIN" ? (
            <Link href="/questions/new" className="btn-primary">
              <Plus size={18} />
              新增题目
            </Link>
          ) : undefined
        }
      />

      {/* 题库统计 */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-slate-500">全部题目</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {totalCount}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-sm text-slate-500">2018 年</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {count2018}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-sm text-slate-500">2019 年</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {count2019}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-sm text-slate-500">2020 年</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {count2020}
          </p>
        </div>
      </div>

      {/* 筛选 */}
      <form className="card mb-5 grid gap-3 p-4 lg:grid-cols-[1fr_150px_170px_auto]">
        <label className="relative">
          <Search
            className="absolute left-3 top-3 text-slate-400"
            size={18}
          />

          <input
            name="q"
            defaultValue={q}
            className="field pl-10"
            placeholder="搜索题干、章节、知识点或来源"
          />
        </label>

        <select name="year" defaultValue={year} className="field">
          <option value="">全部年份</option>
          <option value="2018">2018 年</option>
          <option value="2019">2019 年</option>
          <option value="2020">2020 年</option>
        </select>

        <select name="type" defaultValue={type} className="field">
          <option value="">全部题型</option>

          {Object.entries(typeName).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>

        <button className="btn-secondary">筛选</button>
      </form>

      {/* 当前筛选数量 */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          当前显示{" "}
          <span className="font-medium text-slate-800">
            {filteredCount}
          </span>{" "}
          道题
        </p>

        {(q || year || type) && (
          <Link
            href="/questions"
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            清除筛选
          </Link>
        )}
      </div>

      {/* 题库列表 */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">年份</th>
                <th className="px-4 py-3 font-medium">题号</th>
                <th className="px-5 py-3 font-medium">题目</th>
                <th className="px-4 py-3 font-medium">题型</th>
                <th className="px-4 py-3 font-medium">答案</th>
                <th className="px-4 py-3 font-medium">分值</th>
                <th className="px-4 py-3 font-medium">难度</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {questions.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/70"
                >
                  <td className="px-4 py-4 font-medium text-slate-700">
                    {item.year ?? "—"}
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {item.originalQuestionNumber ?? "—"}
                  </td>

                  <td className="max-w-xl px-5 py-4">
                    <p className="line-clamp-2 font-medium leading-6 text-slate-800">
                      {item.stem}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {item.sourceTitle ||
                        item.sourcePdf ||
                        "手动录入"}
                    </p>
                  </td>

                  <td className="px-4 py-4">
                    {typeName[item.type] || item.type}
                  </td>

                  <td className="px-4 py-4 font-medium text-slate-700">
                    {getAnswerText(item.answer)}
                  </td>

                  <td className="px-4 py-4">
                    {Number(item.defaultScore)} 分
                  </td>

                  <td className="px-4 py-4">
                    {difficultyName[item.difficulty] ||
                      item.difficulty}
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                      已审核
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex justify-end">
                      {user.role === "ADMIN" && (
                        <>
                          <Link
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                            href={`/questions/${item.id}`}
                            title="编辑题目"
                          >
                            <Pencil size={17} />
                          </Link>

                          <DeleteQuestion id={item.id} />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {questions.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-12 text-center text-slate-500"
                  >
                    没有符合条件的题目。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
