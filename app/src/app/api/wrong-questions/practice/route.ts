import {
  NextRequest,
  NextResponse,
} from "next/server";

import { Prisma } from "@prisma/client";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

function shuffleArray<T>(
  items: T[]
): T[] {
  const result = [...items];

  for (
    let i = result.length - 1;
    i > 0;
    i--
  ) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [result[i], result[j]] = [
      result[j],
      result[i],
    ];
  }

  return result;
}

function normalizeStem(
  stem: string
) {
  return stem
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(
      /[，。！？；：、“”‘’（）()【】[\]《》〈〉,.!?;:'"`·—\-_/\\]/g,
      ""
    )
    .trim();
}

function getQuestionKey(
  question: {
    stem: string;
    contentHash?: string | null;
  }
) {
  if (
    question.contentHash &&
    question.contentHash.trim()
  ) {
    return `hash:${question.contentHash.trim()}`;
  }

  return normalizeStem(
    question.stem
  );
}

function getOptionOrder(
  options: Prisma.JsonValue | null
): string[] | null {
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    return null;
  }

  const keys =
    Object.keys(
      options as Record<
        string,
        unknown
      >
    );

  if (!keys.length) {
    return null;
  }

  return shuffleArray(keys);
}

export async function POST(
  req: NextRequest
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

    let count = 20;

    try {
      const body =
        await req.json();

      count = Math.min(
        50,
        Math.max(
          1,
          Number(
            body?.count ?? 20
          )
        )
      );
    } catch {
      // 没有 body 就使用默认20题
    }

    const rows =
      await db.wrongQuestion.findMany({
        where: {
          userId: user.id,
          mastered: false,

          question: {
            type:
              "SINGLE_CHOICE",

            deletedAt: null,

            isActive: true,

            reviewStatus:
              "APPROVED",
          },
        },

        include: {
          question: true,
        },

        orderBy: [
          {
            wrongCount: "desc",
          },
          {
            lastWrongAt: "desc",
          },
        ],
      });

    /*
     * 跨年份重复错题只保留一道
     */
    const seen =
      new Set<string>();

    const uniqueQuestions =
      rows
        .map(
          (item) =>
            item.question
        )
        .filter(
          (question) => {
            const key =
              getQuestionKey(
                question
              );

            if (
              seen.has(key)
            ) {
              return false;
            }

            seen.add(key);

            return true;
          }
        );

    if (
      uniqueQuestions.length ===
      0
    ) {
      return NextResponse.json(
        {
          error:
            "目前没有未掌握的选择题错题",
        },
        {
          status: 400,
        }
      );
    }

    const selected =
      shuffleArray(
        uniqueQuestions
      ).slice(
        0,
        Math.min(
          count,
          uniqueQuestions.length
        )
      );

    const totalScore =
      selected.reduce(
        (sum, question) =>
          sum +
          Number(
            question.defaultScore
          ),
        0
      );

    const durationMinutes =
      Math.min(
        120,
        Math.max(
          15,
          selected.length * 2
        )
      );

    const exam =
      await db.$transaction(
        async (tx) => {
          const createdExam =
            await tx.exam.create({
              data: {
                userId:
                  user.id,

                title:
                  "错题巩固练习",

                totalScore,

                durationMinutes,

                questionCount:
                  selected.length,

                generationConfig:
                  {
                    mode:
                      "WRONG_QUESTION_PRACTICE",

                    questionCount:
                      selected.length,

                    type:
                      "SINGLE_CHOICE",

                    deduplicated:
                      true,
                  } as Prisma.InputJsonValue,

                status:
                  "READY",
              },
            });

          const examQuestions =
            selected.map(
              (
                question,
                index
              ) => {
                const optionsOrder =
                  getOptionOrder(
                    question.options
                  );

                return {
                  examId:
                    createdExam.id,

                  questionId:
                    question.id,

                  questionSnapshot:
                    {
                      id:
                        question.id,

                      year:
                        question.year,

                      originalQuestionNumber:
                        question.originalQuestionNumber,

                      type:
                        question.type,

                      stem:
                        question.stem,

                      options:
                        question.options ??
                        null,

                      explanation:
                        question.explanation ??
                        null,

                      chapter:
                        question.chapter ??
                        null,

                      knowledgePoint:
                        question.knowledgePoint ??
                        null,

                      sourceTitle:
                        question.sourceTitle ??
                        null,

                      sourcePdf:
                        question.sourcePdf ??
                        null,
                    } as Prisma.InputJsonValue,

                  correctAnswerSnapshot:
                    question.answer as Prisma.InputJsonValue,

                  optionsOrder:
                    optionsOrder
                      ? (optionsOrder as Prisma.InputJsonValue)
                      : Prisma.DbNull,

                  score:
                    question.defaultScore,

                  sortOrder:
                    index + 1,
                };
              }
            );

          await tx.examQuestion.createMany({
            data:
              examQuestions,
          });

          return createdExam;
        }
      );

    return NextResponse.json(
      {
        examId: exam.id,

        questionCount:
          exam.questionCount,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Wrong practice error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "生成错题练习失败",
      },
      {
        status: 500,
      }
    );
  }
}
