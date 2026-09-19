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

/*
 * 随机打乱数组
 */
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

/*
 * 标准化题干：
 * 用于判断不同年份是否出现了同一道题。
 *
 * 去除：
 * - 空格
 * - 换行
 * - 常见标点
 * - 全角/半角差异
 */
function normalizeStem(
  stem: string
): string {
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

/*
 * 题目唯一键
 *
 * 如果数据库已有 contentHash，
 * 优先使用 contentHash。
 *
 * 没有 contentHash 时，
 * 使用：题型 + 标准化题干。
 */
function getQuestionKey(
  question: {
    type: string;
    stem: string;
    contentHash?: string | null;
  }
): string {
  if (
    question.contentHash &&
    question.contentHash.trim()
  ) {
    return `hash:${question.contentHash.trim()}`;
  }

  return `${question.type}:${normalizeStem(
    question.stem
  )}`;
}

/*
 * 删除重复题
 */
function dedupeQuestions<
  T extends {
    type: string;
    stem: string;
    contentHash?: string | null;
  }
>(
  questions: T[]
): T[] {
  const seen =
    new Set<string>();

  const result: T[] = [];

  for (const question of questions) {
    const key =
      getQuestionKey(question);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(question);
  }

  return result;
}

/*
 * 选择题选项顺序
 */
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

    /*
     * 年份
     * 不再写死 2018 / 2019 / 2020
     */
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

    /*
     * 考试时间
     */
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

    /*
     * 题量
     */
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

      JUDGMENT:
        Math.floor(
          Number(
            body
              .questionCounts
              ?.JUDGMENT ??
              0
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

      ESSAY:
        Math.floor(
          Number(
            body
              .questionCounts
              ?.ESSAY ??
              0
          )
        ),
    };

    for (
      const type of QUESTION_TYPES
    ) {
      const count =
        requestedCounts[type];

      if (
        !Number.isFinite(count) ||
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

    /*
     * 读取普通题库
     */
    const rawCandidates =
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

    /*
     * 第一层去重：
     * 不同年份重复题，只留下一个。
     */
    const candidates =
      dedupeQuestions(
        rawCandidates
      );

    /*
     * 按题型分组
     */
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

    /*
     * 去重后的题量检查
     */
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
              `${item.name}需要${item.required}题，跨年份去重后只有${item.available}题`
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

    /*
     * ========================================
     * 读取用户未掌握的单选错题
     * ========================================
     */
    const wrongQuestionRows =
      requestedCounts
        .SINGLE_CHOICE > 0
        ? await db.wrongQuestion.findMany(
            {
              where: {
                userId:
                  user.id,

                mastered:
                  false,

                question: {
                  deletedAt:
                    null,

                  isActive:
                    true,

                  reviewStatus:
                    "APPROVED",

                  type:
                    "SINGLE_CHOICE",

                  year: {
                    in: years,
                  },
                },
              },

              include: {
                question: true,
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
          )
        : [];

    /*
     * 错题也要跨年份去重
     */
    const uniqueWrongQuestions =
      dedupeQuestions(
        wrongQuestionRows.map(
          (item) =>
            item.question
        )
      );

    /*
     * 单选题约 25% 使用错题。
     *
     * 例如：
     * 40题 -> 10道
     * 35题 -> 9道
     * 20题 -> 5道
     * 10题 -> 3道
     *
     * 如果没有错题，则正常随机。
     */
    const singleChoiceCount =
      requestedCounts
        .SINGLE_CHOICE;

    const wrongQuestionTarget =
      singleChoiceCount > 0
        ? Math.max(
            1,
            Math.ceil(
              singleChoiceCount *
                0.25
            )
          )
        : 0;

    const wrongQuestionsToUse =
      shuffleArray(
        uniqueWrongQuestions
      ).slice(
        0,
        Math.min(
          wrongQuestionTarget,
          uniqueWrongQuestions.length,
          singleChoiceCount
        )
      );

    /*
     * 已选择错题的唯一键
     */
    const usedQuestionKeys =
      new Set<string>();

    for (
      const question of wrongQuestionsToUse
    ) {
      usedQuestionKeys.add(
        getQuestionKey(
          question
        )
      );
    }

    /*
     * 最终选中的题目
     */
    const selectedByType: Record<
      QuestionType,
      typeof candidates
    > = {
      SINGLE_CHOICE: [],
      JUDGMENT: [],
      SHORT_ANSWER: [],
      ESSAY: [],
    };

    /*
     * ========================================
     * 单选题：
     * 先加入错题，再补普通题
     * ========================================
     */
    selectedByType.SINGLE_CHOICE.push(
      ...wrongQuestionsToUse
    );

    const remainingSingleCount =
      singleChoiceCount -
      selectedByType
        .SINGLE_CHOICE
        .length;

    if (
      remainingSingleCount > 0
    ) {
      const normalChoicePool =
        shuffleArray(
          grouped.SINGLE_CHOICE.filter(
            (question) =>
              !usedQuestionKeys.has(
                getQuestionKey(
                  question
                )
              )
          )
        );

      const additionalChoices =
        normalChoicePool.slice(
          0,
          remainingSingleCount
        );

      selectedByType.SINGLE_CHOICE.push(
        ...additionalChoices
      );

      for (
        const question of additionalChoices
      ) {
        usedQuestionKeys.add(
          getQuestionKey(
            question
          )
        );
      }
    }

    /*
     * ========================================
     * 其他题型正常随机，
     * 但依然去重
     * ========================================
     */
    for (const type of [
      "JUDGMENT",
      "SHORT_ANSWER",
      "ESSAY",
    ] as const) {
      const required =
        requestedCounts[type];

      if (
        required === 0
      ) {
        continue;
      }

      const pool =
        shuffleArray(
          grouped[type].filter(
            (question) =>
              !usedQuestionKeys.has(
                getQuestionKey(
                  question
                )
              )
          )
        );

      const selected =
        pool.slice(
          0,
          required
        );

      selectedByType[
        type
      ].push(...selected);

      for (
        const question of selected
      ) {
        usedQuestionKeys.add(
          getQuestionKey(
            question
          )
        );
      }
    }

    /*
     * ========================================
     * 最后再次检查实际题量
     * ========================================
     */
    const finalShortages: string[] =
      [];

    for (
      const type of QUESTION_TYPES
    ) {
      if (
        selectedByType[type]
          .length <
        requestedCounts[type]
      ) {
        finalShortages.push(
          `${TYPE_NAMES[type]}需要${requestedCounts[type]}题，实际只能生成${selectedByType[type].length}题`
        );
      }
    }

    if (
      finalShortages.length >
      0
    ) {
      return NextResponse.json(
        {
          error:
            "去重后题量不足",
          message:
            finalShortages.join(
              "；"
            ),
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ========================================
     * 题目排序
     * ========================================
     */
    const shouldShuffleQuestions =
      body.shuffleQuestions !==
      false;

    const selectedQuestions:
      typeof candidates = [];

    for (
      const type of QUESTION_TYPES
    ) {
      let questions = [
        ...selectedByType[type],
      ];

      if (
        shouldShuffleQuestions
      ) {
        /*
         * 每个题型内部打乱
         */
        questions =
          shuffleArray(
            questions
          );
      } else {
        /*
         * 不打乱时：
         * 按年份 + 原题号排列
         */
        questions.sort(
          (a, b) => {
            const yearA =
              a.year ?? 0;

            const yearB =
              b.year ?? 0;

            if (
              yearA !== yearB
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

      /*
       * 保持：
       * 单选 → 辨析 → 简答 → 论述
       */
      selectedQuestions.push(
        ...questions
      );
    }

    /*
     * 最后一层保险：
     * 确保整张卷没有重复题。
     */
    const finalQuestions =
      dedupeQuestions(
        selectedQuestions
      );

    if (
      finalQuestions.length !==
      selectedQuestions.length
    ) {
      return NextResponse.json(
        {
          error:
            "检测到重复题",
          message:
            "系统在最终组卷时检测到重复题，请重新生成。",
        },
        {
          status: 409,
        }
      );
    }

    /*
     * 总分
     */
    const totalScore =
      finalQuestions.reduce(
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

    /*
     * 标题
     */
    const title =
      years.length === 1
        ? `${years[0]}年随机模拟卷`
        : `${years[0]}—${
            years[
              years.length - 1
            ]
          }年随机模拟卷`;

    /*
     * ========================================
     * 保存试卷
     * ========================================
     */
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
                    finalQuestions.length,

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

                      /*
                       * 新增记录
                       */
                      deduplicateQuestions:
                        true,

                      wrongQuestionRatio:
                        0.25,

                      wrongQuestionTarget,

                      wrongQuestionIncluded:
                        wrongQuestionsToUse.length,
                    } as Prisma.InputJsonValue,

                  status:
                    "READY",
                },
              }
            );

          const examQuestions =
            finalQuestions.map(
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

        examId:
          exam.id,

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

        /*
         * 方便测试时确认错题混入数量
         */
        wrongQuestionIncluded:
          wrongQuestionsToUse.length,
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
