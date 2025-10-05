import { NextRequest, NextResponse } from "next/server";
import { performCodeReview } from "../code-reviewer";

export async function POST(request: NextRequest) {
  try {
    const { code, fileName } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const analysis = await performCodeReview(code, fileName);

    return NextResponse.json({
      success: true,
      analysis,
      fileName: fileName || "Unknown file",
    });
  } catch (error) {
    console.error("Code review API error:", error);
    return NextResponse.json(
      {
        error: "Failed to perform code review",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
