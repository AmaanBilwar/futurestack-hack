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

    // Log token scopes to help diagnose missing private repos
    try {
      const who = await octokit.request("GET /user", {
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      const scopes = (who.headers as any)["x-oauth-scopes"] ?? "";
      console.log("GitHub token scopes:", scopes);
    } catch (e) {
      console.warn("Could not read token scopes", e);
    }

    // Helper to fetch pages with given params
    async function fetchAllUserRepos(params: Record<string, any>) {
      const results: any[] = [];
      let page = 1;
      while (true) {
        const resp = await octokit.request("GET /user/repos", {
          per_page: 100,
          page,
          sort: "updated",
          ...params,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        });
        const batch = Array.isArray(resp.data) ? resp.data : [];
        results.push(...batch);
        if (batch.length < 100) break;
        page += 1;
        if (page > 20) break; // safety cap
      }
      return results;
    }

    // Helper to fetch org repos with pagination
    async function fetchAllOrgRepos(
      org: string,
      params: Record<string, any> = {},
    ) {
      const results: any[] = [];
      let page = 1;
      while (true) {
        const resp = await octokit.request("GET /orgs/{org}/repos", {
          org,
          per_page: 100,
          page,
          type: "all",
          sort: "updated",
          ...params,
          headers: { "X-GitHub-Api-Version": "2022-11-28" },
        });
        const batch = Array.isArray(resp.data) ? resp.data : [];
        results.push(...batch);
        if (batch.length < 100) break;
        page += 1;
        if (page > 20) break;
      }
      return results;
    }

    // Primary: all affiliations
    const reposAffiliationAll = await fetchAllUserRepos({
      affiliation: "owner,collaborator,organization_member",
    });

    // Try explicit visibility and type variants for completeness
    const [reposVisibilityAll, reposTypeAll, reposTypePrivate] =
      await Promise.all([
        fetchAllUserRepos({
          affiliation: "owner,collaborator,organization_member",
          visibility: "all",
        }),
        fetchAllUserRepos({ type: "all" }),
        fetchAllUserRepos({ type: "private" }),
      ]);

    // Org repos (requires org approval for third-party tokens)
    let orgRepos: any[] = [];
    try {
      const orgsResp = await octokit.request("GET /user/orgs", {
        per_page: 100,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      const orgs = Array.isArray(orgsResp.data) ? orgsResp.data : [];
      const orgNames = orgs
        .map((o: any) => o?.login)
        .filter(Boolean) as string[];
      const fetches = orgNames.map((org) => fetchAllOrgRepos(org));
      const results = await Promise.all(fetches);
      orgRepos = results.flat();
    } catch (e) {
      console.warn(
        "Fetching org repos failed (likely missing org approvals):",
        e,
      );
      orgRepos = [];
    }

    // Merge unique by id
    const byId = new Map<number, any>();
    for (const r of [
      ...reposAffiliationAll,
      ...reposVisibilityAll,
      ...reposTypeAll,
      ...reposTypePrivate,
      ...orgRepos,
    ])
      byId.set((r as any).id, r);

    return NextResponse.json(Array.from(byId.values()));
  } catch (error) {
    console.error("Error listing GitHub repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 },
    );
  }
}
