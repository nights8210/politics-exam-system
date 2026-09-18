import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type SubmitBody = {
  answers?: Record<string, string>;
  durationSeconds?: number;
};

function readCorrectAnswer(value: Prisma.JsonValue) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const data = value as Record<string, unknown>;

    if (typeof data.correct === "string") {
      return data.correct;
    }

    if (typeof data.correct === "boolean") {
      return data.correct;
    }
  }

  return null;
}

export async function POST(
  req: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "未登录" },
        { status: 401 }
      );
    }

    const { id: examId } = await context.params;

    const body = (await req.json()) as SubmitBody;

    const submittedAnswers =
      body.answers &&
      typeof body.answers === "object"
        ? body.answers
        : {};

    const exam = await db.exam.findFirst({
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
        { error: "试卷不存在" },
        { status: 404 }
      );
    }

    const existingAttempt =
      await db.examAttempt.findUnique({
        where: {
          examId_userId: {
            examId,
            userId: user.id,
          },
        },
      });

    if (
      existingAttempt &&
      existingAttempt.status === "SUBMITTED"
    ) {
      return NextResponse.json(
        {
          attemptId: existingAttempt.id,
          message: "该试卷已经交卷",
        },
        { status: 200 }
      );
    }

    let objectiveScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    let pendingSubjectiveCount = 0;

    const answerRows = exam.questions.map(
      (examQuestion) => {
        const snapshot =
          examQuestion.questionSnapshot &&
          typeof examQuestion.questionSnapshot ===
            "object" &&
          !Array.isArray(
            examQuestion.questionSnapshot
          )
            ? (examQuestion.questionSnapshot as Record<
                string,
                unknown
              >)
            : {};

        const type =
          typeof snapshot.type === "string"
            ? snapshot.type
            : "";

        const rawUserAnswer =
          submittedAnswers[examQuestion.id];

        const userAnswer =
          typeof rawUserAnswer === "string"
            ? rawUserAnswer.trim()
            : "";

        const maxScore = Number(
          examQuestion.score
        );

        const correctAnswer =
          readCorrectAnswer(
            examQuestion.correctAnswerSnapshot
          );

        const isObjective =
          type === "SINGLE_CHOICE" ||
          type === "TRUE_FALSE";

        let isCorrect: boolean | null = null;
        let awardedScore = 0;
        let gradingStatus = "PENDING";

        if (!userAnswer) {
          unansweredCount += 1;

          if (isObjective) {
            isCorrect = false;
            gradingStatus = "GRADED";
          } else {
            pendingSubjectiveCount += 1;
          }
        } else if (isObjective) {
          isCorrect =
            String(userAnswer) ===
            String(correctAnswer);

          awardedScore = isCorrect
            ? maxScore
            : 0;

          gradingStatus = "GRADED";

          if (isCorrect) {
            correctCount += 1;
            objectiveScore += awardedScore;
          } else {
            wrongCount += 1;
          }
        } else {
          pendingSubjectiveCount += 1;
        }

        return {
          examQuestionId: examQuestion.id,
          questionId:
            examQuestion.questionId ?? null,

          userAnswer: userAnswer
            ? ({
                value: userAnswer,
              } as Prisma.InputJsonValue)
            : Prisma.JsonNull,

          correctAnswer:
            examQuestion.correctAnswerSnapshot as Prisma.InputJsonValue,

          isCorrect,
          awardedScore,
          maxScore,
          gradingStatus,
        };
      }
    );

    const totalQuestions =
      exam.questions.length;

    const gradedObjective =
      correctCount + wrongCount;

    const accuracy =
      gradedObjective > 0
        ? (correctCount / gradedObjective) * 100
        : 0;

    const attempt = await db.$transaction(
      async (tx) => {
        let attemptRecord;

        if (existingAttempt) {
          await tx.attemptAnswer.deleteMany({
            where: {
              attemptId: existingAttempt.id,
            },
          });

          attemptRecord =
            await tx.examAttempt.update({
              where: {
                id: existingAttempt.id,
              },

              data: {
                submittedAt: new Date(),
                durationSeconds:
                  Math.max(
                    0,
                    Number(
                      body.durationSeconds ?? 0
                    )
                  ) || null,

                score: objectiveScore,
                totalScore: exam.totalScore,

                accuracy,

                correctCount,
                wrongCount,
                unansweredCount,

                status: "SUBMITTED",

                gradingStatus:
                  pendingSubjectiveCount > 0
                    ? "PARTIAL"
                    : "GRADED",
              },
            });
        } else {
          attemptRecord =
            await tx.examAttempt.create({
              data: {
                examId,
                userId: user.id,

                submittedAt: new Date(),

                durationSeconds:
                  Math.max(
                    0,
                    Number(
                      body.durationSeconds ?? 0
                    )
                  ) || null,

                score: objectiveScore,

                totalScore:
                  exam.totalScore,

                accuracy,

                correctCount,
                wrongCount,
                unansweredCount,

                status: "SUBMITTED",

                gradingStatus:
                  pendingSubjectiveCount > 0
                    ? "PARTIAL"
                    : "GRADED",
              },
            });
        }

        if (answerRows.length > 0) {
          await tx.attemptAnswer.createMany({
            data: answerRows.map(
              (answer) => ({
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
          });
        }

        /*
         * 自动维护客观题错题本
         */
        for (const answer of answerRows) {
          if (
            !answer.questionId ||
            answer.isCorrect === null
          ) {
            continue;
          }

          if (answer.isCorrect) {
            const existingWrong =
              await tx.wrongQuestion.findUnique({
                where: {
                  userId_questionId: {
                    userId: user.id,
                    questionId:
                      answer.questionId,
                  },
                },
              });

            if (existingWrong) {
              const nextConsecutive =
                existingWrong.consecutiveCorrect +
                1;

              await tx.wrongQuestion.update({
                where: {
                  id: existingWrong.id,
                },

                data: {
                  correctCount: {
                    increment: 1,
                  },

                  consecutiveCorrect:
                    nextConsecutive,

                  lastCorrectAt:
                    new Date(),

                  mastered:
                    nextConsecutive >= 3,

                  masteredAt:
                    nextConsecutive >= 3
                      ? new Date()
                      : existingWrong.masteredAt,
                },
              });
            }
          } else {
            await tx.wrongQuestion.upsert({
              where: {
                userId_questionId: {
                  userId: user.id,
                  questionId:
                    answer.questionId,
                },
              },

              update: {
                wrongCount: {
                  increment: 1,
                },

                consecutiveCorrect: 0,

                lastWrongAt:
                  new Date(),

                mastered: false,
                masteredAt: null,
              },

              create: {
                userId: user.id,

                questionId:
                  answer.questionId,

                wrongCount: 1,

                correctCount: 0,

                consecutiveCorrect: 0,

                lastWrongAt:
                  new Date(),

                mastered: false,
              },
            });
          }
        }

        return attemptRecord;
      }
    );

    return NextResponse.json({
      attemptId: attempt.id,

      score: Number(attempt.score),

      totalScore: Number(
        attempt.totalScore
      ),

      correctCount,
      wrongCount,
      unansweredCount,

      pendingSubjectiveCount,

      totalQuestions,
    });
  } catch (error) {
    console.error(
      "Submit exam error:",
      error
    );

    return NextResponse.json(
      {
        error: "交卷失败",
      },
      { status: 500 }
    );
  }
}
