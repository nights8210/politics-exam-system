import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type SubmitBody = {
  answers?: Record<string, string>;
  durationSeconds?: number;
};

function asRecord(
  value: unknown
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

/*
 * 读取正确答案
 *
 * 支持：
 *
 * { correct: "A" }
 * { correct: true }
 * "A"
 */
function readCorrectAnswer(
  value: Prisma.JsonValue
): string | boolean | null {
  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (
    typeof value === "boolean"
  ) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const data =
      value as Record<
        string,
        unknown
      >;

    if (
      typeof data.correct ===
      "string"
    ) {
      return data.correct;
    }

    if (
      typeof data.correct ===
      "boolean"
    ) {
      return data.correct;
    }

    if (
      typeof data.answer ===
      "string"
    ) {
      return data.answer;
    }
  }

  return null;
}

export async function POST(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "未登录",
        },
        {
          status: 401,
        }
      );
    }

    const { id: examId } =
      await context.params;

    const body =
      (await req.json()) as SubmitBody;

    const submittedAnswers =
      body.answers &&
      typeof body.answers ===
        "object"
        ? body.answers
        : {};

    /*
     * 查询试卷
     */
    const exam =
      await db.exam.findFirst({
        where: {
          id: examId,
          userId: user.id,
        },

        include: {
          questions: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

    if (!exam) {
      return NextResponse.json(
        {
          error: "试卷不存在",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * 查询是否已有考试记录
     */
    const existingAttempt =
      await db.examAttempt.findUnique({
        where: {
          examId_userId: {
            examId,
            userId: user.id,
          },
        },
      });

    /*
     * 已经交过卷，不重复统计错题
     */
    if (
      existingAttempt &&
      existingAttempt.status ===
        "SUBMITTED"
    ) {
      return NextResponse.json(
        {
          attemptId:
            existingAttempt.id,

          message:
            "该试卷已经交卷",
        },
        {
          status: 200,
        }
      );
    }

    let objectiveScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let pendingSubjectiveCount =
      0;

    /*
     * 处理所有答案
     */
    const answerRows =
      exam.questions.map(
        (examQuestion) => {
          const snapshot =
            asRecord(
              examQuestion
                .questionSnapshot
            );

          const type =
            typeof snapshot.type ===
            "string"
              ? snapshot.type
              : "";

          const rawUserAnswer =
            submittedAnswers[
              examQuestion.id
            ];

          const userAnswer =
            typeof rawUserAnswer ===
            "string"
              ? rawUserAnswer.trim()
              : "";

          const maxScore =
            Number(
              examQuestion.score
            );

          const correctAnswer =
            readCorrectAnswer(
              examQuestion
                .correctAnswerSnapshot
            );

          /*
           * 只有真正可以自动判分的题
           */
          const isAutoGraded =
            type ===
              "SINGLE_CHOICE" ||
            type ===
              "TRUE_FALSE";

          let isCorrect:
            | boolean
            | null = null;

          let awardedScore = 0;

          let gradingStatus =
            "PENDING";

          /*
           * 没有作答
           */
          if (!userAnswer) {
            unansweredCount += 1;

            if (isAutoGraded) {
              isCorrect = false;
              gradingStatus =
                "GRADED";
            } else {
              pendingSubjectiveCount +=
                1;
            }
          }

          /*
           * 自动判分
           */
          else if (
            isAutoGraded
          ) {
            const normalizedUser =
              String(
                userAnswer
              )
                .trim()
                .toUpperCase();

            const normalizedCorrect =
              correctAnswer ===
              null
                ? ""
                : String(
                    correctAnswer
                  )
                    .trim()
                    .toUpperCase();

            isCorrect =
              normalizedUser ===
                normalizedCorrect &&
              normalizedCorrect !==
                "";

            awardedScore =
              isCorrect
                ? maxScore
                : 0;

            gradingStatus =
              "GRADED";

            if (isCorrect) {
              correctCount += 1;

              objectiveScore +=
                awardedScore;
            } else {
              wrongCount += 1;
            }
          }

          /*
           * 主观题
           */
          else {
            pendingSubjectiveCount +=
              1;
          }

          return {
            examQuestionId:
              examQuestion.id,

            questionId:
              examQuestion
                .questionId ??
              null,

            /*
             * 保存题型，
             * 后面判断是否进入错题本
             */
            type,

            userAnswer: userAnswer
              ? ({
                  value:
                    userAnswer,
                } as Prisma.InputJsonValue)
              : Prisma.JsonNull,

            correctAnswer:
              examQuestion
                .correctAnswerSnapshot as Prisma.InputJsonValue,

            isCorrect,

            awardedScore,

            maxScore,

            gradingStatus,
          };
        }
      );

    const gradedObjective =
      correctCount +
      wrongCount;

    const accuracy =
      gradedObjective > 0
        ? (correctCount /
            gradedObjective) *
          100
        : 0;

    /*
     * =====================================
     * 保存考试 + 答案 + 错题本
     * =====================================
     */
    const attempt =
      await db.$transaction(
        async (tx) => {
          let attemptRecord;

          /*
           * 如果之前存在未完成记录
           */
          if (existingAttempt) {
            await tx.attemptAnswer.deleteMany(
              {
                where: {
                  attemptId:
                    existingAttempt.id,
                },
              }
            );

            attemptRecord =
              await tx.examAttempt.update(
                {
                  where: {
                    id:
                      existingAttempt.id,
                  },

                  data: {
                    submittedAt:
                      new Date(),

                    durationSeconds:
                      Math.max(
                        0,
                        Number(
                          body.durationSeconds ??
                            0
                        )
                      ) || null,

                    score:
                      objectiveScore,

                    totalScore:
                      exam.totalScore,

                    accuracy,

                    correctCount,

                    wrongCount,

                    unansweredCount,

                    status:
                      "SUBMITTED",

                    gradingStatus:
                      pendingSubjectiveCount >
                      0
                        ? "PARTIAL"
                        : "GRADED",
                  },
                }
              );
          } else {
            /*
             * 新考试记录
             */
            attemptRecord =
              await tx.examAttempt.create(
                {
                  data: {
                    examId,

                    userId:
                      user.id,

                    submittedAt:
                      new Date(),

                    durationSeconds:
                      Math.max(
                        0,
                        Number(
                          body.durationSeconds ??
                            0
                        )
                      ) || null,

                    score:
                      objectiveScore,

                    totalScore:
                      exam.totalScore,

                    accuracy,

                    correctCount,

                    wrongCount,

                    unansweredCount,

                    status:
                      "SUBMITTED",

                    gradingStatus:
                      pendingSubjectiveCount >
                      0
                        ? "PARTIAL"
                        : "GRADED",
                  },
                }
              );
          }

          /*
           * 保存所有答题记录
           */
          if (
            answerRows.length >
            0
          ) {
            await tx.attemptAnswer.createMany(
              {
                data:
                  answerRows.map(
                    (
                      answer
                    ) => ({
                      attemptId:
                        attemptRecord.id,

                      examQuestionId:
                        answer.examQuestionId,

                      questionId:
                        answer.questionId,

                      userAnswer:
                        answer.userAnswer,

                      correctAnswer:
                        answer.correctAnswer,

                      isCorrect:
                        answer.isCorrect,

                      awardedScore:
                        answer.awardedScore,

                      maxScore:
                        answer.maxScore,

                      gradingStatus:
                        answer.gradingStatus,
                    })
                  ),
              }
            );
          }

          /*
           * ===================================
           * 错题本
           *
           * 重要规则：
           * 只处理 SINGLE_CHOICE
           * ===================================
           */
          for (
            const answer of answerRows
          ) {
            /*
             * 不是单选题：
             * 完全跳过
             */
            if (
              answer.type !==
              "SINGLE_CHOICE"
            ) {
              continue;
            }

            /*
             * 没有关联正式题库题目
             */
            if (
              !answer.questionId
            ) {
              continue;
            }

            /*
             * 无法判分
             */
            if (
              answer.isCorrect ===
              null
            ) {
              continue;
            }

            /*
             * =================================
             * 单选题答对
             * =================================
             */
            if (
              answer.isCorrect
            ) {
              const existingWrong =
                await tx.wrongQuestion.findUnique(
                  {
                    where: {
                      userId_questionId:
                        {
                          userId:
                            user.id,

                          questionId:
                            answer.questionId,
                        },
                    },
                  }
                );

              /*
               * 如果以前从没答错过，
               * 不创建错题记录。
               */
              if (
                !existingWrong
              ) {
                continue;
              }

              const nextConsecutive =
                existingWrong.consecutiveCorrect +
                1;

              /*
               * 连续答对3次：
               * 自动标记已掌握
               */
              const mastered =
                nextConsecutive >=
                3;

              await tx.wrongQuestion.update(
                {
                  where: {
                    id:
                      existingWrong.id,
                  },

                  data: {
                    correctCount:
                      {
                        increment: 1,
                      },

                    consecutiveCorrect:
                      nextConsecutive,

                    lastCorrectAt:
                      new Date(),

                    mastered,

                    masteredAt:
                      mastered
                        ? existingWrong.masteredAt ??
                          new Date()
                        : null,
                  },
                }
              );
            }

            /*
             * =================================
             * 单选题答错
             * =================================
             */
            else {
              await tx.wrongQuestion.upsert(
                {
                  where: {
                    userId_questionId:
                      {
                        userId:
                          user.id,

                        questionId:
                          answer.questionId,
                      },
                  },

                  update: {
                    wrongCount: {
                      increment: 1,
                    },

                    /*
                     * 一旦再次答错，
                     * 连续正确清零
                     */
                    consecutiveCorrect:
                      0,

                    lastWrongAt:
                      new Date(),

                    mastered:
                      false,

                    masteredAt:
                      null,
                  },

                  create: {
                    userId:
                      user.id,

                    questionId:
                      answer.questionId,

                    wrongCount:
                      1,

                    correctCount:
                      0,

                    consecutiveCorrect:
                      0,

                    lastWrongAt:
                      new Date(),

                    mastered:
                      false,
                  },
                }
              );
            }
          }

          return attemptRecord;
        }
      );

    /*
     * 统计本次实际新增/更新的单选错题
     */
    const choiceWrongCount =
      answerRows.filter(
        (answer) =>
          answer.type ===
            "SINGLE_CHOICE" &&
          answer.isCorrect ===
            false
      ).length;

    return NextResponse.json(
      {
        attemptId:
          attempt.id,

        score:
          Number(
            attempt.score
          ),

        totalScore:
          Number(
            attempt.totalScore
          ),

        correctCount,

        wrongCount,

        unansweredCount,

        pendingSubjectiveCount,

        /*
         * 专门提供给前端/调试
         */
        choiceWrongCount,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "Submit exam error:",
      error
    );

    return NextResponse.json(
      {
        error: "交卷失败",
      },
      {
        status: 500,
      }
    );
  }
}
