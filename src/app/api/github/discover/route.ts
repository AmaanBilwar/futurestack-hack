import { NextRequest, NextResponse } from "next/server";
import { discoverFilesWithMCP } from "../mcp-utils";

export async function POST(request: NextRequest) {
  try {
    console.log("API route called");

    const body = await request.json();
    console.log("Request body:", body);

    const { owner, repo, token, ref } = body;

    if (!owner || !repo) {
      console.log("Missing required fields:", { owner, repo });
      return NextResponse.json(
        { error: "Owner and repo are required" },
        { status: 400 },
      );
    }

    console.log(`Discovering files for ${owner}/${repo} using MCP`);

    // Resolve token: prefer body token, else fetch from auth helper
    let githubToken = token as string | undefined;
    if (!githubToken) {
      try {
        const url = new URL(request.url);
        const resp = await fetch(`${url.origin}/api/auth/convex/token`, {
          headers: { cookie: request.headers.get("cookie") ?? "" },
          cache: "no-store",
        });
        if (resp.ok) {
          const data = await resp.json();
          githubToken =
            data && typeof data === "object"
              ? (data.token ?? data.accessToken ?? null)
              : typeof data === "string"
                ? data
                : null;
        }
      } catch (e) {
        console.warn("Failed to resolve GitHub token from auth helper:", e);
      }
    }

    // Use MCP utils to discover files (pass per-user token for GitHub MCP)
    const discoveredFiles = await discoverFilesWithMCP(
      owner,
      repo,
      githubToken,
      ref as string | undefined,
    );

    console.log("Returning discovered files:", discoveredFiles.length);
    return NextResponse.json(discoveredFiles);
  } catch (error) {
    console.error("Error discovering repository files with MCP:", error);
    return NextResponse.json(
      { error: "Failed to discover repository files" },
      { status: 500 },
    );
  }
}
