import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { code, analysis, fileName, fileType, fileSize, userId, sessionId } =
      await request.json();

    // Save file to Convex storage
    const fileId = await convex.mutation(api.files.createFile, {
      name: fileName,
      content: code,
      type: fileType || "text/plain",
      size: fileSize || code.length,
      userId: userId,
      metadata: {
        language: getLanguageFromFileName(fileName),
        extension: getFileExtension(fileName),
        lines: code.split("\n").length,
        characters: code.length,
      },
    });

    // Create analysis record
    const analysisId = await convex.mutation(api.analyses.createAnalysis, {
      fileId: fileId,
      fileName: fileName,
      analysis: analysis || "Analysis pending",
      status: "completed",
      userId: userId,
    });

    // If sessionId is provided, add file to session
    if (sessionId) {
      await convex.mutation(api.sessions.addFileToSession, {
        sessionId: sessionId,
        fileId: fileId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Docker environment created successfully",
        fileId: fileId,
        analysisId: analysisId,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Create docker environment API error:", error);
    return NextResponse.json(
      { error: "Failed to create docker environment" },
      { status: 500 },
    );
  }
}

function getLanguageFromFileName(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    php: "php",
    rb: "ruby",
    go: "go",
    rs: "rust",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    r: "r",
    m: "matlab",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    fish: "bash",
    ps1: "powershell",
    bat: "batch",
    cmd: "batch",
    sql: "sql",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    vue: "vue",
    svelte: "svelte",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    ini: "ini",
    conf: "conf",
    config: "conf",
  };
  return languageMap[extension || ""] || "text";
}

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}
