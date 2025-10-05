import { NextRequest, NextResponse } from "next/server";
import { applyRefactor } from "./applyRefactor";

export async function POST(request: NextRequest) {
  try {
    const { code, fileName, analysis, filePath } = await request.json();

    if (!code || !fileName) {
      return NextResponse.json(
        { error: "code and fileName are required" },
        { status: 400 },
      );
    }

    // Build default new filename (server-side) and pass full target path to tool
    const lastDot = fileName.lastIndexOf(".");
    const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
    const ext = lastDot > -1 ? fileName.slice(lastDot) : "";
    const refactoredFileName = `${base}_refactored${ext}`;
    const refactoredFilePath = filePath
      ? (() => {
          const lastSlash = filePath.lastIndexOf("/");
          const dir = lastSlash > -1 ? filePath.slice(0, lastSlash + 1) : "";
          return `${dir}${refactoredFileName}`;
        })()
      : refactoredFileName;

    const refactoredContents = await applyRefactor(
      code,
      analysis || "",
      fileName,
      refactoredFilePath,
    );
    return NextResponse.json({
      success: true,
      refactoredFileName,
      refactoredFilePath,
      refactoredContents,
    });
  } catch (error) {
    console.error("Refactor API error:", error);
    return NextResponse.json(
      {
        error: "Failed to apply refactor",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
