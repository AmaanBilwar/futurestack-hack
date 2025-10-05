import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { owner, repo, path, token, ref } = await request.json();
    if (!owner || !repo || !path) {
      return NextResponse.json(
        { error: "owner, repo, and path are required" },
        { status: 400 },
      );
    }

    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(
        path,
      )}`,
    );
    if (ref) url.searchParams.set("ref", ref);

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "codemarshall-github-file",
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetch(url.toString(), { headers });
    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: "Failed to fetch file", details: text || resp.statusText },
        { status: resp.status },
      );
    }

    const json: any = await resp.json();
    // contents API returns base64-encoded content for files
    const encoding: string = json?.encoding;
    const base64: string | undefined = json?.content;
    let content = "";
    if (encoding === "base64" && typeof base64 === "string") {
      // Node at edge supports atob? Use Buffer API
      content = Buffer.from(base64, "base64").toString("utf-8");
    } else if (typeof json?.download_url === "string") {
      // Fallback: try raw download URL
      const raw = await fetch(json.download_url);
      content = await raw.text();
    } else {
      content = typeof json?.content === "string" ? json.content : "";
    }

    return NextResponse.json({
      path,
      name: json?.name || path.split("/").pop() || path,
      content,
      size: typeof json?.size === "number" ? json.size : content.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unexpected error fetching file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
