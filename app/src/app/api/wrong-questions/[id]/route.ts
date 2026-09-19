import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
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

    const { id } = await context.params;

    const body = await req.json();

    const mastered =
      body?.mastered === true;

    const wrong =
      await db.wrongQuestion.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

    if (!wrong) {
      return NextResponse.json(
        {
          error: "错题记录不存在",
        },
        {
          status: 404,
        }
      );
    }

    await db.wrongQuestion.update({
      where: {
        id,
      },

      data: {
        mastered,

        masteredAt: mastered
          ? new Date()
          : null,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Update wrong question error:",
      error
    );

    return NextResponse.json(
      {
        error: "更新失败",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const user = await getCurrentUser();

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

    const { id } =
      await context.params;

    const wrong =
      await db.wrongQuestion.findFirst({
        where: {
          id,
          userId: user.id,
        },
      });

    if (!wrong) {
      return NextResponse.json(
        {
          error: "错题记录不存在",
        },
        {
          status: 404,
        }
      );
    }

    await db.wrongQuestion.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Delete wrong question error:",
      error
    );

    return NextResponse.json(
      {
        error: "删除失败",
      },
      {
        status: 500,
      }
    );
  }
}
