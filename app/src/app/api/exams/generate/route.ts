import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const QUESTION_TYPES = [
  "SINGLE_CHOICE",
  "JUDGMENT",
  "SHORT_ANSWER",
  "ESSAY",
] as const;

const TYPE_NAMES: Record<string, string> = {
  SINGLE_CHOICE: "单选题",
  JUDGMENT: "辨析题",
  SHORT_ANSWER: "简答题",
  ESSAY: "论述题",
};

type QuestionType =
  (typeof QUESTION_TYPES)[number];

type GenerateExamBody = {
  years?: number[];

  questionCounts?: {
    SINGLE_CHOICE?: number;
    JUDGMENT?: number;
    SHORT_ANSWER?: number;
    ESSAY?: number;
  };

  durationMinutes?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
};

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

function getOptionOrder(
  options: Prisma.JsonValue | null,
  shouldShuffle: boolean
): string[] | null {
  if (
    !options ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    return null;
  }

  const keys = Object.keys(
    options as Record<
      string,
      unknown
    >
  );

  if (keys.length === 0) {
    return null;
  }

  return shouldShuffle
    ? shuffleArray(keys)
    : keys;
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

    const body =
      (await req.json()) as GenerateExamBody;

    const years = Array.from(
  new Set(
    (body.years ?? [])
      .map(Number)
      .filter(
        (year) =>
          Number.isInteger(year) &&
          year >= 1900 &&
          year <= 2100
      )
  )
).sort(
  (a, b) => a - b
);

    if (
      years.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "请至少选择一个年份",
        },
        {
          status: 400,
        }
      );
    }

    const durationMinutes =
      Math.floor(
        Number(
          body.durationMinutes ??
            150
        )
      );

    if (
      !Number.isFinite(
        durationMinutes
      ) ||
      durationMinutes < 1 ||
      durationMinutes > 600
    ) {
      return NextResponse.json(
        {
          error:
            "考试时长必须在1到600分钟之间",
        },
        {
          status: 400,
        }
      );
    }

    const requestedCounts: Record<
      QuestionType,
      number
    > = {
      SINGLE_CHOICE:
        Math.floor(
          Number(
            body
              .questionCounts
              ?.SINGLE_CHOICE ??
              0
          )
        ),

      JUDGMENT: Math.floor(
        Number(
          body
            .questionCounts
            ?.JUDGMENT ?? 0
        )
      ),

      SHORT_ANSWER:
        Math.floor(
          Number(
            body
              .questionCounts
              ?.SHORT_ANSWER ??
              0
          )
        ),

      ESSAY: Math.floor(
        Number(
          body
            .questionCounts
            ?.ESSAY ?? 0
        )
      ),
    };

    for (
      const type of QUESTION_TYPES
    ) {
      const count =
        requestedCounts[type];

      if (
        !Number.isFinite(
          count
        ) ||
        count < 0 ||
        count > 100
      ) {
        return NextResponse.json(
          {
            error: `${TYPE_NAMES[type]}数量不正确`,
          },
          {
            status: 400,
          }
        );
      }
    }

    const totalQuestionCount =
      Object.values(
        requestedCounts
      ).reduce(
        (sum, count) =>
          sum + count,
        0
      );

    if (
      totalQuestionCount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "试卷至少需要一道题",
        },
        {
          status: 400,
        }
      );
    }

    const candidates =
      await db.question.findMany(
        {
          where: {
            deletedAt: null,
            isActive: true,
            reviewStatus:
              "APPROVED",

            year: {
              in: years,
            },

            type: {
              in: [
                ...QUESTION_TYPES,
              ],
            },
          },

          orderBy: [
            {
              year: "asc",
            },
            {
              createdAt:
                "asc",
            },
          ],
        }
      );

    const grouped: Record<
      QuestionType,
      typeof candidates
    > = {
      SINGLE_CHOICE: [],
      JUDGMENT: [],
      SHORT_ANSWER: [],
      ESSAY: [],
    };

    for (
      const question of candidates
    ) {
      if (
        QUESTION_TYPES.includes(
          question.type as QuestionType
        )
      ) {
        grouped[
          question.type as QuestionType
        ].push(question);
      }
    }

    const shortages: Array<{
      type: QuestionType;
      name: string;
      required: number;
      available: number;
    }> = [];

    for (
      const type of QUESTION_TYPES
    ) {
      const required =
        requestedCounts[type];

      const available =
        grouped[type].length;

      if (
        required > available
      ) {
        shortages.push({
          type,
          name:
            TYPE_NAMES[type],
          required,
          available,
        });
      }
    }

    if (
      shortages.length > 0
    ) {
      const message =
        shortages
          .map(
            (item) =>
              `${item.name}需要${item.required}题，当前只有${item.available}题`
          )
          .join("；");

      return NextResponse.json(
        {
          error:
            "题库题量不足",
          message,
          shortages,
        },
        {
          status: 400,
        }
      );
    }

    const selectedQuestions: typeof candidates =
      [];

    const shouldShuffleQuestions =
      body.shuffleQuestions !==
      false;

    for (
      const type of QUESTION_TYPES
    ) {
      const required =
        requestedCounts[type];

      if (
        required === 0
      ) {
        continue;
      }

      let pool = [
        ...grouped[type],
      ];

      pool =
        shuffleArray(pool);

      let selected =
        pool.slice(
          0,
          required
        );

      if (
        !shouldShuffleQuestions
      ) {
        selected =
          selected.sort(
            (a, b) => {
              const yearA =
                a.year ?? 0;

              const yearB =
                b.year ?? 0;

              if (
                yearA !==
                yearB
              ) {
                return (
                  yearA -
                  yearB
                );
              }

              const numberA =
                Number(
                  a.originalQuestionNumber ??
                    0
                );

              const numberB =
                Number(
                  b.originalQuestionNumber ??
                    0
                );

              return (
                numberA -
                numberB
              );
            }
          );
      }

      selectedQuestions.push(
        ...selected
      );
    }

    const totalScore =
      selectedQuestions.reduce(
        (
          sum,
          question
        ) =>
          sum +
          Number(
            question.defaultScore
          ),
        0
      );

    const title =
      years.length === 1
        ? `${years[0]}年随机模拟卷`
        : `${years[0]}—${
            years[
              years.length - 1
            ]
          }年随机模拟卷`;

    const exam =
      await db.$transaction(
        async (tx) => {
          const createdExam =
            await tx.exam.create(
              {
                data: {
                  userId:
                    user.id,

                  title,

                  totalScore,

                  durationMinutes,

                  questionCount:
                    selectedQuestions.length,

                  generationConfig:
                    {
                      years,

                      questionCounts:
                        requestedCounts,

                      shuffleQuestions:
                        shouldShuffleQuestions,

                      shuffleOptions:
                        body.shuffleOptions !==
                        false,
                    } as Prisma.InputJsonValue,

                  status:
                    "READY",
                },
              }
            );

          const examQuestions =
            selectedQuestions.map(
              (
                question,
                index
              ) => {
                const optionsOrder =
                  getOptionOrder(
                    question.options,
                    body.shuffleOptions !==
                      false
                  );

                const questionSnapshot =
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

                    chapter:
                      question.chapter ??
                      null,

                    knowledgePoint:
                      question.knowledgePoint ??
                      null,

                    difficulty:
                      question.difficulty,

                    explanation:
                      question.explanation ??
                      null,

                    sourceTitle:
                      question.sourceTitle ??
                      null,

                    sourcePdf:
                      question.sourcePdf ??
                      null,
                  };

                return {
                  examId:
                    createdExam.id,

                  questionId:
                    question.id,

                  questionSnapshot:
                    questionSnapshot as Prisma.InputJsonValue,

                  optionsOrder:
                    optionsOrder
                      ? (optionsOrder as Prisma.InputJsonValue)
                      : Prisma.DbNull,

                  correctAnswerSnapshot:
                    question.answer as Prisma.InputJsonValue,

                  score:
                    question.defaultScore,

                  sortOrder:
                    index + 1,
                };
              }
            );

          await tx.examQuestion.createMany(
            {
              data:
                examQuestions,
            }
          );

          return createdExam;
        }
      );

    return NextResponse.json(
      {
        id: exam.id,
        examId: exam.id,

        title:
          exam.title,

        questionCount:
          exam.questionCount,

        totalScore:
          Number(
            exam.totalScore
          ),

        durationMinutes:
          exam.durationMinutes,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Generate exam error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "生成试卷失败",
      },
      {
        status: 500,
      }
    );
  }
}
