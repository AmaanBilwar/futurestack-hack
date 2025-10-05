import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Generate upload URL endpoint
export async function POST(request: NextRequest) {
  try {
    const { name, type, size, userId, sessionId } = await request.json();

    // Step 1: Generate upload URL
    const uploadUrl = await convex.mutation(api.files.generateUploadUrl);

    return NextResponse.json(
      {
        success: true,
        uploadUrl,
        message: "Upload URL generated successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Generate upload URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 },
    );
  }
}

// Save file with storage ID endpoint
export async function PUT(request: NextRequest) {
  try {
    const { name, storageId, type, size, userId, sessionId, content } =
      await request.json();

    // Calculate metadata from content if provided (for legacy compatibility)
    const metadata = content
      ? {
          language: getLanguageFromFileName(name),
          extension: getFileExtension(name),
          lines: content.split("\n").length,
          characters: content.length,
        }
      : {
          language: getLanguageFromFileName(name),
          extension: getFileExtension(name),
        };

    // Save file to Convex storage
    const fileId = await convex.mutation(api.files.saveFileWithStorageId, {
      name,
      storageId,
      type: type || "text/plain",
      size: size || 0,
      userId,
      metadata,
    });

    // If sessionId is provided, add file to session
    if (sessionId) {
      await convex.mutation(api.sessions.addFileToSession, {
        sessionId,
        fileId,
      });
    }

    return NextResponse.json(
      {
        success: true,
        fileId,
        message: "File saved successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("File save API error:", error);
    return NextResponse.json({ error: "Failed to save file" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = searchParams.get("limit");
    const fileId = searchParams.get("fileId");
    const storageId = searchParams.get("storageId");

    // If requesting specific file content
    if (storageId) {
      const content = await convex.query(api.files.getFileContent, {
        storageId: storageId as any,
      });

      if (content && typeof content === "object" && "arrayBuffer" in content) {
        const arrayBuffer = await (content as any).arrayBuffer();
        const text = new TextDecoder().decode(arrayBuffer);
        return NextResponse.json(
          {
            success: true,
            content: text,
          },
          { status: 200 },
        );
      } else {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
    }

    // If requesting specific file metadata
    if (fileId) {
      const file = await convex.query(api.files.getFile, {
        fileId: fileId as any,
      });

      return NextResponse.json(
        {
          success: true,
          file,
        },
        { status: 200 },
      );
    }

    // Get all files for user
    const files = await convex.query(api.files.getUserFiles, {
      userId: userId || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        files: limit ? files.slice(0, parseInt(limit)) : files,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Get files API error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve files" },
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
