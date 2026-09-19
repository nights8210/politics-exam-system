"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  FileText,
  Loader2,
  Shuffle,
} from "lucide-react";

import { PageHeading } from "@/components/page-heading";

type YearInfo = {
  year: number;
  count: number;
};

export default function Page() {
  const router = useRouter();

  const [
    availableYears,
    setAvailableYears,
  ] = useState<YearInfo[]>([]);

  const [years, setYears] =
    useState<number[]>([]);

  const [
    loadingYears,
    setLoadingYears,
  ] = useState(true);

  const [
    singleChoiceCount,
    setSingleChoiceCount,
  ] = useState(40);

  const [
    judgmentCount,
    setJudgmentCount,
  ] = useState(2);

  const [
    shortAnswerCount,
    setShortAnswerCount,
  ] = useState(3);

  const [
    essayCount,
    setEssayCount,
  ] = useState(1);

  const [
    durationMinutes,
    setDurationMinutes,
  ] = useState(150);

  const [
    shuffleQuestions,
    setShuffleQuestions,
  ] = useState(true);

  const [
    shuffleOptions,
    setShuffleOptions,
  ] = useState(true);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
   * 自动读取数据库中已有年份
   */
  useEffect(() => {
    let cancelled = false;

    async function loadYears() {
      try {
        setLoadingYears(true);

        const response = await fetch(
          "/api/questions/years",
          {
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "读取年份失败"
          );
        }

        const list: YearInfo[] =
          Array.isArray(data?.years)
            ? data.years
            : [];

        if (cancelled) {
          return;
        }

        setAvailableYears(list);

        /*
         * 第一次进入页面：
         * 默认选中所有年份
         */
        setYears(
          list.map(
            (item) => item.year
          )
        );
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            "无法读取题库年份，请稍后重试。"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingYears(false);
        }
      }
    }

    loadYears();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalQuestions =
    singleChoiceCount +
    judgmentCount +
    shortAnswerCount +
    essayCount;

  const totalScore =
    useMemo(() => {
      return (
        singleChoiceCount * 2 +
        judgmentCount * 10 +
        shortAnswerCount * 10 +
        essayCount * 20
      );
    }, [
      singleChoiceCount,
      judgmentCount,
      shortAnswerCount,
      essayCount,
    ]);

  function toggleYear(
    year: number
  ) {
    setYears((current) => {
      if (
        current.includes(year)
      ) {
        return current.filter(
          (item) =>
            item !== year
        );
      }

      return [
        ...current,
        year,
      ].sort(
        (a, b) => a - b
      );
    });
  }

  function selectAllYears() {
    setYears(
      availableYears.map(
        (item) => item.year
      )
    );
  }

  function clearYears() {
    setYears([]);
  }

  /*
   * 根据当前选择年份，
   * 自动决定更合适的标准结构。
   *
   * 2018—2020：
   * 40单选 + 2辨析 + 3简答 + 1论述
   *
   * 2021以后：
   * 35单选 + 0辨析 + 4简答 + 2论述
   */
  function resetStandardExam() {
    const onlyNewFormat =
      years.length > 0 &&
      years.every(
        (year) => year >= 2021
      );

    if (onlyNewFormat) {
      setSingleChoiceCount(35);
      setJudgmentCount(0);
      setShortAnswerCount(4);
      setEssayCount(2);
    } else {
      setSingleChoiceCount(40);
      setJudgmentCount(2);
      setShortAnswerCount(3);
      setEssayCount(1);
    }

    setDurationMinutes(150);
    setShuffleQuestions(true);
    setShuffleOptions(true);
    setError("");
  }

  async function generateExam() {
    setError("");

    if (
      years.length === 0
    ) {
      setError(
        "请至少选择一个年份。"
      );
      return;
    }

    if (
      totalQuestions <= 0
    ) {
      setError(
        "试卷至少需要一道题。"
      );
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/exams/generate",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              years,

              questionCounts: {
                SINGLE_CHOICE:
                  singleChoiceCount,

                JUDGMENT:
                  judgmentCount,

                SHORT_ANSWER:
                  shortAnswerCount,

                ESSAY:
                  essayCount,
              },

              durationMinutes,
              shuffleQuestions,
              shuffleOptions,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data?.message ||
            data?.error ||
            "生成试卷失败，请稍后重试。"
        );

        return;
      }

      const examId =
        data.examId ||
        data.id;

      if (!examId) {
        setError(
          "试卷已经生成，但服务器没有返回试卷编号。"
        );

        return;
      }

      router.push(
        `/exams/${examId}/take`
      );
    } catch {
      setError(
        "连接服务器失败，请稍后重试。"
      );
    } finally {
      setLoading(false);
    }
  }

  const yearRangeText =
    availableYears.length > 0
      ? `${availableYears[0].year}—${
          availableYears[
            availableYears.length - 1
          ].year
        }`
      : "已导入";

  return (
    <>
      <PageHeading
        title="生成随机试卷"
        description={`从${yearRangeText}年真题题库中随机抽题，生成一套练习试卷。`}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* 年份 */}
          <section className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  题目范围
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  年份会自动根据题库数据更新。
                </p>
              </div>

              {!loadingYears &&
                availableYears.length >
                  0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={
                        selectAllYears
                      }
                      className="btn-secondary"
                    >
                      全选
                    </button>

                    <button
                      type="button"
                      onClick={
                        clearYears
                      }
                      className="btn-secondary"
                    >
                      清空
                    </button>
                  </div>
                )}
            </div>

            {loadingYears ? (
              <div className="mt-5 flex items-center gap-2 text-sm text-slate-500">
                <Loader2
                  size={18}
                  className="animate-spin"
                />

                正在读取题库年份...
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-3">
                {availableYears.map(
                  (item) => {
                    const selected =
                      years.includes(
                        item.year
                      );

                    return (
                      <button
                        key={
                          item.year
                        }
                        type="button"
                        onClick={() =>
                          toggleYear(
                            item.year
                          )
                        }
                        className={
                          selected
                            ? "rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-left text-sm font-medium text-white"
                            : "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
                        }
                      >
                        <span className="block">
                          {
                            item.year
                          }{" "}
                          年
                        </span>

                        <span
                          className={`mt-0.5 block text-xs ${
                            selected
                              ? "text-slate-300"
                              : "text-slate-400"
                          }`}
                        >
                          {
                            item.count
                          }{" "}
                          题
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            )}

            {!loadingYears &&
              availableYears.length ===
                0 && (
                <p className="mt-4 text-sm text-amber-600">
                  当前没有可用于组卷的正式题目。
                </p>
              )}
          </section>

          {/* 试卷结构 */}
          <section className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  试卷结构
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  可以使用标准结构，也可以自行调整题量。
                </p>
              </div>

              <button
                type="button"
                onClick={
                  resetStandardExam
                }
                className="btn-secondary"
              >
                标准模拟卷
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      题型
                    </th>

                    <th className="px-4 py-3 text-center font-medium">
                      数量
                    </th>

                    <th className="px-4 py-3 text-center font-medium">
                      每题
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      小计
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  <QuestionRow
                    label="单选题"
                    value={
                      singleChoiceCount
                    }
                    score={2}
                    onChange={
                      setSingleChoiceCount
                    }
                  />

                  <QuestionRow
                    label="辨析题"
                    value={
                      judgmentCount
                    }
                    score={10}
                    onChange={
                      setJudgmentCount
                    }
                  />

                  <QuestionRow
                    label="简答题"
                    value={
                      shortAnswerCount
                    }
                    score={10}
                    onChange={
                      setShortAnswerCount
                    }
                  />

                  <QuestionRow
                    label="论述题"
                    value={
                      essayCount
                    }
                    score={20}
                    onChange={
                      setEssayCount
                    }
                  />
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end gap-8 text-sm">
              <p className="text-slate-500">
                总题数：
                <span className="ml-1 font-semibold text-slate-900">
                  {
                    totalQuestions
                  }
                </span>
              </p>

              <p className="text-slate-500">
                总分：
                <span className="ml-1 font-semibold text-slate-900">
                  {totalScore}
                </span>
              </p>
            </div>
          </section>

          {/* 考试设置 */}
          <section className="card p-5">
            <h2 className="text-base font-semibold text-slate-900">
              考试设置
            </h2>

            <div className="mt-5 max-w-xs">
              <label className="text-sm font-medium text-slate-700">
                考试时长
              </label>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={
                    durationMinutes
                  }
                  onChange={(
                    event
                  ) =>
                    setDurationMinutes(
                      Math.max(
                        1,
                        Number(
                          event
                            .target
                            .value
                        ) || 1
                      )
                    )
                  }
                  className="field"
                />

                <span className="text-sm text-slate-500">
                  分钟
                </span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={
                    shuffleQuestions
                  }
                  onChange={(
                    event
                  ) =>
                    setShuffleQuestions(
                      event.target
                        .checked
                    )
                  }
                />

                <span className="text-sm text-slate-700">
                  随机打乱题目顺序
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={
                    shuffleOptions
                  }
                  onChange={(
                    event
                  ) =>
                    setShuffleOptions(
                      event.target
                        .checked
                    )
                  }
                />

                <span className="text-sm text-slate-700">
                  随机打乱选择题选项
                </span>
              </label>
            </div>
          </section>
        </div>

        {/* 右侧摘要 */}
        <aside>
          <div className="card sticky top-6 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <FileText
                  size={21}
                />
              </div>

              <div>
                <p className="font-semibold text-slate-900">
                  本次试卷
                </p>

                <p className="text-sm text-slate-500">
                  随机模拟考试
                </p>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-100 border-y border-slate-100">
              <SummaryRow
                label="年份"
                value={
                  years.length
                    ? years.join(
                        "、"
                      )
                    : "未选择"
                }
              />

              <SummaryRow
                label="题目"
                value={`${totalQuestions} 题`}
              />

              <SummaryRow
                label="总分"
                value={`${totalScore} 分`}
              />

              <SummaryRow
                label="时长"
                value={`${durationMinutes} 分钟`}
              />
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={
                loading ||
                loadingYears
              }
              onClick={
                generateExam
              }
              className="btn-primary mt-5 w-full justify-center"
            >
              <Shuffle
                size={18}
              />

              {loading
                ? "正在生成试卷..."
                : "生成试卷"}
            </button>

            <p className="mt-3 text-xs leading-5 text-slate-400">
              系统只会从已审核、已启用的正式题目中随机抽题。
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function QuestionRow({
  label,
  value,
  score,
  onChange,
}: {
  label: string;
  value: number;
  score: number;
  onChange: (
    value: number
  ) => void;
}) {
  return (
    <tr>
      <td className="px-4 py-3 font-medium text-slate-700">
        {label}
      </td>

      <td className="px-4 py-3 text-center">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(event) =>
            onChange(
              Math.max(
                0,
                Number(
                  event.target
                    .value
                ) || 0
              )
            )
          }
          className="field mx-auto w-20 text-center"
        />
      </td>

      <td className="px-4 py-3 text-center text-slate-500">
        {score} 分
      </td>

      <td className="px-4 py-3 text-right font-medium text-slate-800">
        {value * score} 分
      </td>
    </tr>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <span className="text-slate-500">
        {label}
      </span>

      <span className="font-medium text-slate-800">
        {value}
      </span>
    </div>
  );
}
