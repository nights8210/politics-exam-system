"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  CheckCircle2,
  Play,
  Trash2,
} from "lucide-react";

export function StartWrongPracticeButton({
  count,
}: {
  count: number;
}) {
  const router =
    useRouter();

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function startPractice() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/wrong-questions/practice",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              count:
                Math.min(
                  20,
                  count
                ),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data?.error ||
            "生成练习失败"
        );

        return;
      }

      router.push(
        `/exams/${data.examId}/take`
      );
    } catch {
      setError(
        "连接服务器失败"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={
          startPractice
        }
        disabled={
          loading ||
          count <= 0
        }
        className="btn-primary"
      >
        <Play size={17} />

        {loading
          ? "正在生成..."
          : "开始错题练习"}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function WrongQuestionActions({
  id,
}: {
  id: string;
}) {
  const router =
    useRouter();

  const [loading, setLoading] =
    useState(false);

  async function markMastered() {
    if (loading) {
      return;
    }

    const confirmed =
      window.confirm(
        "确定将这道题标记为已掌握吗？"
      );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          `/api/wrong-questions/${id}`,
          {
            method: "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              mastered: true,
            }),
          }
        );

      if (!response.ok) {
        const data =
          await response.json();

        window.alert(
          data?.error ||
            "操作失败"
        );

        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (loading) {
      return;
    }

    const confirmed =
      window.confirm(
        "确定删除这道错题记录吗？删除后不会影响正式题库。"
      );

    if (!confirmed) {
      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          `/api/wrong-questions/${id}`,
          {
            method:
              "DELETE",
          }
        );

      if (!response.ok) {
        const data =
          await response.json();

        window.alert(
          data?.error ||
            "删除失败"
        );

        return;
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={
          markMastered
        }
        className="btn-secondary"
      >
        <CheckCircle2
          size={16}
        />

        标记已掌握
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={remove}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2
          size={16}
        />

        删除
      </button>
    </div>
  );
}
