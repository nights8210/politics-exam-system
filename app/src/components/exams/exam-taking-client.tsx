"use client";

import {
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

export function ExamTakingClient({
  exam,
}: Props) {
  const router = useRouter();

  const startTimeRef = useRef(Date.now());

  const [answers, setAnswers] = useState<
    Record<string, string>
  >({});

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const singleChoiceQuestions = useMemo(
    () =>
      exam.questions.filter(
        (question) =>
          question.type === "SINGLE_CHOICE"
      ),
    [exam.questions]
  );

  const choiceAnsweredCount = useMemo(
    () =>
      singleChoiceQuestions.filter(
        (question) =>
          (answers[question.id] ?? "").trim()
            .length > 0
      ).length,
    [answers, singleChoiceQuestions]
  );

  const answeredCount = useMemo(() => {
    return exam.questions.filter(
      (question) =>
        (answers[question.id] ?? "").trim()
          .length > 0
    ).length;
  }, [answers, exam.questions]);

  function updateAnswer(
    questionId: string,
    value: string
  ) {
    setAnswers((current) => ({
      ...current,
      [questionId]: value,
    }));
  }

  async function submitExam() {
    if (submitting) return;

    const unansweredChoices =
      singleChoiceQuestions.length -
      choiceAnsweredCount;

    let message = "确定要交卷吗？";

    if (unansweredChoices > 0) {
      message =
        `还有 ${unansweredChoices} 道选择题未作答。\n\n` +
        "确定仍然交卷吗？";
    }

    if (!window.confirm(message)) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const durationSeconds = Math.max(
        0,
        Math.floor(
          (Date.now() -
            startTimeRef.current) /
            1000
        )
      );

      const response = await fetch(
        `/api/exams/${exam.id}/submit`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            answers,
            durationSeconds,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data?.message ||
            data?.error ||
            "交卷失败，请稍后重试。"
        );

        setSubmitting(false);
        return;
      }

      if (!data.attemptId) {
        setError(
          "交卷成功，但没有取得考试记录编号。"
        );

        setSubmitting(false);
        return;
      }

      router.push(
        `/attempts/${data.attemptId}`
      );
    } catch (err) {
      console.error(err);

      setError(
        "连接服务器失败，请稍后重试。"
      );

      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
      <main className="space-y-5">
        {exam.questions.map(
          (question, index) => {
            const optionKeys =
              question.optionsOrder?.length
                ? question.optionsOrder
                : question.options
                  ? Object.keys(
                      question.options
                    )
                  : [];

            return (
              <section
                key={question.id}
                className="card p-5"
              >
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                    {typeName[
                      question.type
                    ] || question.type}
                  </span>

                  {question.year && (
                    <span className="text-slate-400">
                      {question.year}年
                    </span>
                  )}

                  {question.originalQuestionNumber && (
                    <span className="text-slate-400">
                      原题第
                      {
                        question.originalQuestionNumber
                      }
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
                      {optionKeys.map(
                        (key) => {
                          const text =
                            question
                              .options?.[key];

                          const checked =
                            answers[
                              question.id
                            ] === key;

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
                                name={
                                  question.id
                                }
                                value={key}
                                checked={
                                  checked
                                }
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

                                <span>
                                  {text}
                                </span>
                              </div>
                            </label>
                          );
                        }
                      )}
                    </div>
                  )}

                {question.type ===
                  "JUDGMENT" && (
                  <textarea
                    value={
                      answers[
                        question.id
                      ] ?? ""
                    }
                    onChange={(event) =>
                      updateAnswer(
                        question.id,
                        event.target.value
                      )
                    }
                    className="field mt-5 min-h-32"
                    placeholder="可填写判断和理由，也可以留空，交卷后查看参考答案。"
                  />
                )}

                {(question.type ===
                  "SHORT_ANSWER" ||
                  question.type ===
                    "ESSAY" ||
                  question.type ===
                    "MATERIAL_ANALYSIS") && (
                  <textarea
                    value={
                      answers[
                        question.id
                      ] ?? ""
                    }
                    onChange={(event) =>
                      updateAnswer(
                        question.id,
                        event.target.value
                      )
                    }
                    className="field mt-5 min-h-40"
                    placeholder="可填写答案，也可以留空，交卷后查看参考答案。"
                  />
                )}
              </section>
            );
          }
        )}
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
                选择题已答
              </span>

              <span className="font-medium">
                {choiceAnsweredCount}/
                {
                  singleChoiceQuestions.length
                }
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">
                全部已答
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
                      answers[
                        question.id
                      ]
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

          <div className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            选择题交卷后自动评分。
            辨析题、简答题和论述题以查看参考答案为主，
            不进入错题本。
          </div>

          {error && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submitExam}
            disabled={submitting}
            className="btn-primary mt-5 w-full justify-center"
          >
            {submitting
              ? "正在交卷..."
              : "交卷"}
          </button>

          <Link
            href="/exams/generate"
            className="btn-secondary mt-3 w-full justify-center"
          >
            返回组卷
          </Link>
        </div>
      </aside>
    </div>
  );
}
