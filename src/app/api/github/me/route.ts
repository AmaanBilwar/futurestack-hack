import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "octokit";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "GitHub token is required" },
        { status: 400 },
      );
    }

    const octokit = new Octokit({ auth: token });
    const resp = await octokit.request("GET /user", {
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
    });

    const login = (resp.data as any)?.login ?? null;
    const name = (resp.data as any)?.name ?? null;
    const avatarUrl = (resp.data as any)?.avatar_url ?? null;
    const scopes = (resp.headers as any)["x-oauth-scopes"] ?? "";

    return NextResponse.json({ login, name, avatarUrl, scopes });
  } catch (error) {
    console.error("Error fetching GitHub user:", error);
    return NextResponse.json(
      { error: "Failed to fetch GitHub user" },
      { status: 500 },
    );
  }
}
