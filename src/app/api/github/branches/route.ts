import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, token } = body ?? {};

    if (!owner || !repo || !token) {
      return NextResponse.json(
        { error: "owner, repo and token are required" },
        { status: 400 },
      );
    }

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "codemarshall-mcp-utils",
      Authorization: `Bearer ${token}`,
    };

    // Deterministic REST listing of branches
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/branches`,
    );
    url.searchParams.set("per_page", "100");
    const resp = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!resp.ok) {
      const text = await resp.text();
      console.warn("Branches API: fetch failed", resp.status, text);
      return NextResponse.json([], { status: 200 });
    }

    const data = await resp.json();
    if (!Array.isArray(data)) return NextResponse.json([], { status: 200 });

    const branches = data
      .map((b: any) => ({
        name: b?.name,
        commitSha: b?.commit?.sha,
        protected: Boolean(b?.protected),
      }))
      .filter((b: any) => b.name);

    return NextResponse.json(branches);
  } catch (error) {
    console.error("Error listing branches:", error);
    return NextResponse.json(
      { error: "Failed to list branches" },
      { status: 500 },
    );
  }
}
