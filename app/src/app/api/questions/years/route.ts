import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "未登录" },
        { status: 401 }
      );
    }

    const rows = await db.question.groupBy({
      by: ["year"],

      where: {
        deletedAt: null,
        isActive: true,
        reviewStatus: "APPROVED",

        year: {
          not: null,
        },
      },

      _count: {
        _all: true,
      },

      orderBy: {
        year: "asc",
      },
    });

    const years = rows
      .filter(
        (
          item
        ): item is typeof item & {
          year: number;
        } => item.year !== null
      )
      .map((item) => ({
        year: item.year,
        count: item._count._all,
      }));

    return NextResponse.json({
      years,
    });
  } catch (error) {
    console.error(
      "Load question years error:",
      error
    );

    return NextResponse.json(
      {
        error: "读取题库年份失败",
      },
      { status: 500 }
    );
  }
}
