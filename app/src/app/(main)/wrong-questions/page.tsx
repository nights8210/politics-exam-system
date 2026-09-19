import {
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

import { PageHeading } from "@/components/page-heading";

import {
  StartWrongPracticeButton,
  WrongQuestionActions,
} from "@/components/wrong-questions/wrong-question-actions";

import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "错题本",
};

function asRecord(
  value: unknown
): Record<
  string,
  unknown
> {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}

function getCorrectAnswer(
  answerValue: unknown,
  optionsValue: unknown
) {
  const answer =
    asRecord(answerValue);

  let key = "";

  if (
    typeof answer.correct ===
    "string"
  ) {
    key =
      answer.correct;
  } else if (
    typeof answer.answer ===
    "string"
  ) {
    key =
      answer.answer;
  } else if (
    typeof answerValue ===
    "string"
  ) {
    key =
      answerValue;
  }

  key =
    key
      .trim()
      .toUpperCase();

  if (!key) {
    return "—";
  }

  const options =
    asRecord(optionsValue);

  const text =
    options[key];

  if (
    typeof text ===
    "string"
  ) {
    return `${key}. ${text}`;
  }

  return key;
}

function formatDate(
  date: Date | null
) {
  if (!date) {
    return "—";
  }

  return date.toLocaleString(
    "zh-CN",
    {
      timeZone:
        "Asia/Hong_Kong",

      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );
}

export default async function WrongQuestionsPage() {
  const user =
    await requireUser();

  const [
    wrongQuestions,
    masteredCount,
  ] =
    await Promise.all([
      db.wrongQuestion.findMany(
        {
          where: {
            userId:
              user.id,

            mastered:
              false,

            question: {
              type:
                "SINGLE_CHOICE",

              deletedAt:
                null,

              isActive:
                true,
            },
          },

          include: {
            question:
              true,
          },

          orderBy: [
            {
              wrongCount:
                "desc",
            },
            {
              lastWrongAt:
                "desc",
            },
          ],
        }
      ),

      db.wrongQuestion.count({
        where: {
          userId:
            user.id,

          mastered:
            true,

          question: {
            type:
              "SINGLE_CHOICE",
          },
        },
      }),
    ]);

  const totalWrongTimes =
    wrongQuestions.reduce(
      (sum, item) =>
        sum +
        item.wrongCount,
      0
    );

  return (
    <>
      <PageHeading
        title="错题本"
        description="集中复习选择题错题。连续答对3次后，系统会自动标记为已掌握。"
        action={
          wrongQuestions.length >
          0 ? (
            <StartWrongPracticeButton
              count={
                wrongQuestions.length
              }
            />
          ) : undefined
        }
      />

      {/* 统计 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-red-50 text-red-600">
              <AlertCircle
                size={20}
              />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                未掌握错题
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {
                  wrongQuestions.length
                }
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
              <RotateCcw
                size={20}
              />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                累计错误次数
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {
                  totalWrongTimes
                }
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2
                size={20}
              />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                已掌握
              </p>

              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {
                  masteredCount
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {wrongQuestions.length ===
      0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2
              size={27}
            />
          </div>

          <h2 className="mt-4 font-semibold text-slate-900">
            当前没有未掌握的选择题错题
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            完成随机试卷后，答错的选择题会自动进入这里。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {wrongQuestions.map(
            (
              item,
              index
            ) => {
              const question =
                item.question;

              const correctAnswer =
                getCorrectAnswer(
                  question.answer,
                  question.options
                );

              return (
                <section
                  key={
                    item.id
                  }
                  className="card p-5"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-600">
                      选择题错题
                    </span>

                    {question.year && (
                      <span className="text-slate-400">
                        {
                          question.year
                        }
                        年
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
                  </div>

                  <p className="mt-4 font-medium leading-7 text-slate-900">
                    {index + 1}.{" "}
                    {
                      question.stem
                    }
                  </p>

                  {question.options &&
                    typeof question.options ===
                      "object" &&
                    !Array.isArray(
                      question.options
                    ) && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {Object.entries(
                          question.options as Record<
                            string,
                            unknown
                          >
                        ).map(
                          ([
                            key,
                            value,
                          ]) => (
                            <div
                              key={
                                key
                              }
                              className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              <span className="mr-2 font-semibold">
                                {
                                  key
                                }.
                              </span>

                              {String(
                                value
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}

                  <div className="mt-4 rounded-xl bg-emerald-50 p-4">
                    <p className="text-xs font-medium text-emerald-600">
                      正确答案
                    </p>

                    <p className="mt-2 font-semibold leading-6 text-emerald-800">
                      {
                        correctAnswer
                      }
                    </p>

                    {question.explanation && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-emerald-800">
                        {
                          question.explanation
                        }
                      </p>
                    )}
                  </div>

                  <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <p className="text-slate-500">
                        错误次数：
                        <span className="ml-1 font-semibold text-red-600">
                          {
                            item.wrongCount
                          }
                        </span>
                      </p>

                      <p className="text-slate-500">
                        连续答对：
                        <span className="ml-1 font-semibold text-slate-800">
                          {
                            item.consecutiveCorrect
                          }
                          /3
                        </span>
                      </p>

                      <p className="text-slate-500">
                        最近答错：
                        <span className="ml-1 text-slate-700">
                          {formatDate(
                            item.lastWrongAt
                          )}
                        </span>
                      </p>
                    </div>

                    <WrongQuestionActions
                      id={
                        item.id
                      }
                    />
                  </div>
                </section>
              );
            }
          )}
        </div>
      )}
    </>
  );
}
