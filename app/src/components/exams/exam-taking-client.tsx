"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type QuestionItem = {
  id: string;
  type: string;
  stem: string;
  options: Record<string, string> | null;
  optionsOrder: string[] | null;
  score: number;
  sortOrder: number;
  year: number | null;
  originalQuestionNumber: string | null;
};

type Props = {
  exam: {
    id: string;
    title: string;
    totalScore: number;
    durationMinutes: number;
    questionCount: number;
    questions: QuestionItem[];
  };
};

const typeName: Record<string, string> = {
  SINGLE_CHOICE: "单选题",
  MULTIPLE_CHOICE: "多选题",
  TRUE_FALSE: "判断题",
  JUDGMENT: "辨析题",
  SHORT_ANSWER: "简答题",
  MATERIAL_ANALYSIS: "材料分析题",
  ESSAY: "论述题",
};

export function ExamTakingClient({ exam }: Props) {
  const [answers, setAnswers] = useState<
    Record<string, string>
  >({});

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(
      (value) => value.trim().length > 0
    ).length;
  }, [answers]);

  function updateAnswer(
    questionId: string,
    value: string
  ) {
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <main className="space-y-5">
        {exam.questions.map((question, index) => {
          const optionKeys =
            question.optionsOrder?.length
              ? question.optionsOrder
              : question.options
                ? Object.keys(question.options)
                : [];

          return (
            <section
              key={question.id}
              className="card p-5"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                  {typeName[question.type] ||
                    question.type}
                </span>

                {question.year && (
                  <span className="text-slate-400">
                    {question.year}年
                  </span>
                )}

                {question.originalQuestionNumber && (
                  <span className="text-slate-400">
                    原题第
                    {question.originalQuestionNumber}
                    题
                  </span>
                )}

                <span className="ml-auto text-slate-500">
                  {question.score} 分
                </span>
              </div>

              <div className="flex gap-3">
                <span className="font-semibold text-slate-900">
                  {index + 1}.
                </span>

                <p className="font-medium leading-7 text-slate-900">
                  {question.stem}
                </p>
              </div>

              {question.type ===
                "SINGLE_CHOICE" &&
                question.options && (
                  <div className="mt-5 space-y-3">
                    {optionKeys.map((key) => {
                      const text =
                        question.options?.[key];

                      const checked =
                        answers[question.id] === key;

                      return (
                        <label
                          key={key}
                          className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                            checked
                              ? "border-red-300 bg-red-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={key}
                            checked={checked}
                            onChange={() =>
                              updateAnswer(
                                question.id,
                                key
                              )
                            }
                            className="mt-1"
                          />

                          <div>
                            <span className="mr-2 font-semibold">
                              {key}.
                            </span>

                            <span>{text}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

              {question.type === "JUDGMENT" && (
                <textarea
                  value={
                    answers[question.id] ?? ""
                  }
                  onChange={(event) =>
                    updateAnswer(
                      question.id,
                      event.target.value
                    )
                  }
                  className="field mt-5 min-h-32"
                  placeholder="请输入你的判断和理由..."
                />
              )}

              {(question.type ===
                "SHORT_ANSWER" ||
                question.type === "ESSAY" ||
                question.type ===
                  "MATERIAL_ANALYSIS") && (
                <textarea
                  value={
                    answers[question.id] ?? ""
                  }
                  onChange={(event) =>
                    updateAnswer(
                      question.id,
                      event.target.value
                    )
                  }
                  className="field mt-5 min-h-40"
                  placeholder="请输入你的答案..."
                />
              )}
            </section>
          );
        })}
      </main>

      <aside>
        <div className="card sticky top-6 p-5">
          <h2 className="font-semibold text-slate-900">
            {exam.title}
          </h2>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">
                题目
              </span>
              <span>
                {exam.questionCount} 题
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">
                总分
              </span>
              <span>
                {exam.totalScore} 分
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">
                考试时间
              </span>
              <span>
                {exam.durationMinutes} 分钟
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">
                已作答
              </span>
              <span>
                {answeredCount}/
                {exam.questionCount}
              </span>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-5">
            <div className="grid grid-cols-5 gap-2">
              {exam.questions.map(
                (question, index) => (
                  <div
                    key={question.id}
                    className={`flex h-9 items-center justify-center rounded-lg text-xs font-medium ${
                      answers[question.id]
                        ? "bg-red-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {index + 1}
                  </div>
                )
              )}
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-700">
            当前阶段先验证试卷显示和答题功能。
            提交、自动评分和考试记录将在下一步接入。
          </div>

          <Link
            href="/exams/generate"
            className="btn-secondary mt-4 w-full justify-center"
          >
            返回组卷
          </Link>
        </div>
      </aside>
    </div>
  );
}
