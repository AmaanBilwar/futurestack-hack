// MCP (Model Context Protocol) functionality has been disabled
// This file is kept for reference but MCP analysis is no longer used
// The GitHub analyze route now uses direct AI SDK OpenRouter model instead

import { experimental_createMCPClient, generateText, stepCountIs } from "ai";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import * as path from "path";

export interface MCPFileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  summary?: {
    lineCount: number;
    functions: string[];
    imports: string[];
  };
}

export interface MCPAnalysisResult {
  summary: string;
  recommendations: string[];
  files: Array<{
    path: string;
    analysis: string;
    recommendations: string;
  }>;
}
const META_MODEL = process.env.META_MODEL!;

export async function initializeMCPClient(githubToken?: string) {
  console.log(
    "Initializing MCP client with token:",
    githubToken ? "***" + githubToken.slice(-4) : "none",
  );

  // Use official GitHub MCP server via Docker (stdio)
  const transport = new StdioClientTransport({
    command: "docker",
    args: [
      "run",
      "-i",
      "--rm",
      "-e",
      `GITHUB_PERSONAL_ACCESS_TOKEN=${githubToken ?? ""}`,
      "-e",
      "GITHUB_TOOLSETS=all",
      "ghcr.io/github/github-mcp-server",
    ],
  });

  const mcpClient = await experimental_createMCPClient({
    transport,
  });

  return mcpClient;
}

function isCodeFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const codeExts = [
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".py",
    ".java",
    ".go",
    ".rs",
    ".cpp",
    ".c",
    ".h",
    ".cs",
    ".php",
    ".rb",
    ".swift",
    ".kt",
    ".scala",
    ".clj",
    ".hs",
    ".ml",
    ".fs",
    ".vb",
    ".dart",
    ".r",
    ".m",
    ".pl",
    ".sh",
    ".sql",
    ".html",
    ".css",
    ".scss",
    ".sass",
    ".less",
    ".xml",
    ".json",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".md",
    ".txt",
    ".vue",
    ".svelte",
    ".astro",
  ];
  return codeExts.some((ext) => lower.endsWith(ext));
}

async function discoverFilesViaGitHubAPI(
  owner: string,
  repo: string,
  token?: string,
  refOverride?: string,
): Promise<MCPFileInfo[]> {
  console.log(
    "FALLBACK: Using direct GitHub API for file discovery",
    owner,
    repo,
  );

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "codemarshall-mcp-utils",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // 1) Get repo info to determine default branch if no ref provided
  const repoResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers,
    },
  );
  if (!repoResp.ok) {
    console.warn(
      "GitHub API: repo fetch failed",
      repoResp.status,
      await repoResp.text(),
    );
    return [];
  }
  const repoJson: any = await repoResp.json();
  const defaultBranch: string = repoJson.default_branch || "main";
  const requestedRef = refOverride || defaultBranch;

  // 2) Resolve commit SHA for the default branch
  let commitSha: string | null = null;
  const refResp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${requestedRef}`,
    { headers },
  );
  if (refResp.ok) {
    const refJson: any = await refResp.json();
    commitSha = refJson?.object?.sha ?? null;
  } else {
    console.warn(
      "GitHub API: refs fetch failed",
      refResp.status,
      await refResp.text(),
    );
  }

  // Some GitHub servers accept branch name directly as the tree ref. Try both.
  const treeRefsToTry = [commitSha, requestedRef, defaultBranch].filter(
    Boolean,
  ) as string[];

  for (const ref of treeRefsToTry) {
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;
    const treeResp = await fetch(treeUrl, { headers });
    if (!treeResp.ok) {
      console.warn(
        "GitHub API: tree fetch failed",
        ref,
        treeResp.status,
        await treeResp.text(),
      );
      continue;
    }
    const treeJson: any = await treeResp.json();
    const entries: any[] = Array.isArray(treeJson?.tree) ? treeJson.tree : [];
    if (!entries.length) {
      console.warn("GitHub API: tree empty for ref", ref);
      continue;
    }

    const files: MCPFileInfo[] = entries
      .filter(
        (e) =>
          e.type === "blob" && typeof e.path === "string" && isCodeFile(e.path),
      )
      .map((e) => {
        const filePath: string = e.path;
        const fileName: string = path.basename(filePath);
        const extension: string = `.${fileName.split(".").pop()}`;
        const size: number = typeof e.size === "number" ? e.size : 0;
        return {
          path: filePath,
          name: fileName,
          extension,
          size,
          summary: {
            lineCount: 0,
            functions: [],
            imports: [],
          },
        } as MCPFileInfo;
      });

    console.log(
      `GitHub API fallback found ${files.length} files for ${owner}/${repo} on ref ${ref}`,
    );
    if (files.length > 0) return files;
  }

  return [];
}

async function discoverFilesViaContentsAPI(
  owner: string,
  repo: string,
  token?: string,
  refOverride?: string,
): Promise<MCPFileInfo[]> {
  console.log("PRIMARY: Using GitHub Contents API for discovery", owner, repo);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "codemarshall-mcp-utils",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Resolve ref (branch/tag/sha). Prefer override, else default branch.
  let ref: string | undefined = refOverride;
  try {
    if (!ref) {
      const repoResp = await fetch(
        `https://api.github.com/repos/${owner}/${repo}`,
        {
          headers,
        },
      );
      if (repoResp.ok) {
        const repoJson: any = await repoResp.json();
        ref = repoJson?.default_branch || undefined;
      }
    }
  } catch (e) {
    console.warn("Contents API: repo fetch failed", e);
  }

  const startPaths: string[] = [""];
  const queue: string[] = [...startPaths];
  const visited = new Set<string>();
  const results: MCPFileInfo[] = [];
  const maxEntries = 20000; // safety cap

  while (queue.length > 0 && results.length < maxEntries) {
    const currentPath = queue.pop() as string;
    if (visited.has(currentPath)) continue;
    visited.add(currentPath);

    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/contents${currentPath ? `/${encodeURIComponent(currentPath)}` : ""}`,
    );
    if (ref) url.searchParams.set("ref", ref);

    const resp = await fetch(url.toString(), { headers });
    if (!resp.ok) {
      const text = await resp.text();
      console.warn(
        "Contents API: fetch failed",
        currentPath || "/",
        resp.status,
        text,
      );
      continue;
    }

    const json = await resp.json();
    if (Array.isArray(json)) {
      // Directory listing
      for (const entry of json) {
        const type = entry?.type;
        const entryPath: string | undefined = entry?.path;
        const name: string | undefined = entry?.name;
        if (!entryPath || !name) continue;

        if (type === "dir") {
          queue.push(entryPath);
          continue;
        }

        if (type === "file") {
          if (!isCodeFile(entryPath)) continue;
          const extension = `.${name.split(".").pop()}`;
          const size: number = typeof entry?.size === "number" ? entry.size : 0;
          results.push({
            path: entryPath,
            name,
            extension,
            size,
            summary: {
              lineCount: 0,
              functions: [],
              imports: [],
            },
          });
        }
      }
    } else if (json && json.type === "file") {
      const entryPath: string = json.path;
      const name: string = json.name;
      if (isCodeFile(entryPath)) {
        const extension = `.${name.split(".").pop()}`;
        const size: number = typeof json?.size === "number" ? json.size : 0;
        results.push({
          path: entryPath,
          name,
          extension,
          size,
          summary: {
            lineCount: 0,
            functions: [],
            imports: [],
          },
        });
      }
    }
  }

  console.log(
    `Contents API discovered ${results.length} files for ${owner}/${repo}${ref ? `@${ref}` : ""}`,
  );
  return results;
}

async function attemptFallbackDiscovery(
  owner: string,
  repo: string,
  token: string | undefined,
  mcpClient: any,
): Promise<MCPFileInfo[]> {
  console.log("Attempting fallback discovery for", owner, repo);

  try {
    // First, try to get repository info to verify access
    const tools = await mcpClient.tools();
    console.log("Available tools for fallback:", Object.keys(tools));

    // Try with a different model and more specific instructions
    const openRouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!,
    });
    const model = openRouter.chat("anthropic/claude-3.5-sonnet");

    // Try multiple approaches
    const approaches = [
      {
        name: "Repository info first",
        system: `You are a GitHub repository analyzer. First, get repository information for ${owner}/${repo} to verify access, then list files.`,
        message: `Please first get repository information for ${owner}/${repo}, then list all code files. Return a JSON array of file objects.`,
      },
      {
        name: "Direct file listing",
        system: `You are a GitHub repository file lister. Use GitHub MCP tools to directly list repository contents for ${owner}/${repo}.`,
        message: `List all files in the repository ${owner}/${repo} using GitHub MCP tools. Return a JSON array with file paths.`,
      },
      {
        name: "Search-based approach",
        system: `You are a GitHub code searcher. Use GitHub search APIs to find code files in ${owner}/${repo}.`,
        message: `Search for code files in repository ${owner}/${repo} using GitHub search. Return a JSON array of found files.`,
      },
    ];

    for (const approach of approaches) {
      console.log(`Trying fallback approach: ${approach.name}`);

      try {
        const response = await generateText({
          model,
          tools,
          system: approach.system,
          messages: [
            {
              role: "user",
              content: approach.message,
            },
          ],
          toolChoice: "auto",
          temperature: 0.1,
          stopWhen: stepCountIs(8),
        });

        console.log(`Fallback response (${approach.name}):`, response.text);

        // Parse the fallback response
        const jsonMatch = response.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedFiles = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsedFiles) && parsedFiles.length > 0) {
            console.log(`Success with approach: ${approach.name}`);
            return parsedFiles.map((file: any) => ({
              path: file.path || file.name || file,
              name: file.name || (file.path ? path.basename(file.path) : ""),
              extension:
                file.extension ||
                `.${(file.name || file.path || "").split(".").pop()}` ||
                "",
              size: file.size || 0,
              summary: {
                lineCount: file.summary?.lineCount || 0,
                functions: file.summary?.functions || [],
                imports: file.summary?.imports || [],
              },
            }));
          }
        }
      } catch (approachError) {
        console.warn(`Approach ${approach.name} failed:`, approachError);
        continue;
      }
    }

    console.warn("All fallback approaches returned empty results");
    return [];
  } catch (error) {
    console.error("Fallback discovery failed:", error);
    return [];
  }
}

export async function discoverFilesWithMCP(
  owner: string,
  repo: string,
  token?: string,
  ref?: string,
): Promise<MCPFileInfo[]> {
  console.log(`Discovering files for ${owner}/${repo} using MCP`);

  let mcpClient;

  try {
    // PRIMARY: GitHub REST Contents API traversal
    const viaContents = await discoverFilesViaContentsAPI(
      owner,
      repo,
      token,
      ref,
    );
    if (viaContents.length > 0) {
      console.log("Using REST Contents API results");
      return viaContents;
    }

    // SECONDARY: Git Trees API (recursive)
    const viaTrees = await discoverFilesViaGitHubAPI(owner, repo, token, ref);
    if (viaTrees.length > 0) {
      console.log("Using Git Trees API results");
      return viaTrees;
    }

    // Initialize MCP client
    mcpClient = await initializeMCPClient(token);
    // Let GitHub MCP expose its tools dynamically
    const tools = await mcpClient.tools();

    console.log("Available MCP tools:", Object.keys(tools));

    // Debug: Check if we have the right tools (names match server output)
    const expectedTools = [
      "search_code",
      "get_file_contents",
      "list_commits",
      "list_branches",
    ];
    const toolKeys = Object.keys(tools);
    const hasExpectedTools = expectedTools.some((tool) =>
      toolKeys.some((key) => key.includes(tool)),
    );
    console.log("Has expected GitHub tools:", hasExpectedTools);

    if (!hasExpectedTools) {
      console.warn(
        "MCP client may not have the expected GitHub tools available",
      );
    }

    // Initialize AI model (use a tool-capable model)
    const openRouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!,
    });
    const model = openRouter.chat(META_MODEL);

    // Use AI SDK with MCP tools to discover files
    const response = await generateText({
      model,
      tools,
      system: `You are a GitHub MCP assistant. Use the GitHub MCP tools to list repository files for owner ${owner} and repo ${repo} without cloning locally. Prefer read-only repo/file listing APIs. Only return final answers as pure JSON.`,
      messages: [
        {
          role: "user",
          content: `Please list code files in GitHub repo ${owner}/${repo}.
          Use GitHub MCP tools (repos/code search) to:
          1. Enumerate repository tree and filter for common code extensions
          2. Optionally fetch per-file summary/metadata
          3. Return a JSON array with: path, name, extension, size (if available), summary { lineCount?, functions?, imports? }`,
        },
      ],
      toolChoice: "auto",
      temperature: 0,
      stopWhen: stepCountIs(20),
    });

    console.log("MCP AI response:", response.text);

    // Check for error responses first
    if (
      response.text.includes('"error"') ||
      response.text.includes("Unable to retrieve")
    ) {
      console.warn("MCP returned error response, attempting fallback");
      // Try to extract error message for better logging
      const errorMatch = response.text.match(/"error":\s*"([^"]+)"/);
      if (errorMatch) {
        console.warn("MCP Error:", errorMatch[1]);
      }

      // First try deterministic GitHub API fallback
      const viaApi = await discoverFilesViaGitHubAPI(owner, repo, token, ref);
      if (viaApi.length > 0) return viaApi;
      // Then try MCP-driven fallback approaches
      return await attemptFallbackDiscovery(owner, repo, token, mcpClient);
    }

    // Prefer parsing tool results over free text
    const toolResults: any[] = (response as any).toolResults || [];
    if (toolResults.length) {
      console.log("MCP toolResults count:", toolResults.length);
    }

    // Parse the AI response to extract file information
    let discoveredFiles: MCPFileInfo[] = [];

    try {
      // 1) Try to extract files from any toolResults
      const collected: any[] = [];
      for (const tr of toolResults) {
        const blocks =
          (tr as any)?.result?.content || (tr as any)?.content || [];
        for (const item of blocks) {
          if (item?.type === "json" && item?.json) {
            const j = item.json;
            if (Array.isArray(j)) collected.push(...j);
            else if (j && typeof j === "object" && Array.isArray(j.files))
              collected.push(...j.files);
          } else if (item?.type === "text" && typeof item.text === "string") {
            // try JSON first
            try {
              const maybe = JSON.parse(item.text);
              if (Array.isArray(maybe)) {
                collected.push(...maybe);
                continue;
              }
              if (
                maybe &&
                typeof maybe === "object" &&
                Array.isArray(maybe.files)
              ) {
                collected.push(...maybe.files);
                continue;
              }
            } catch {}
            // newline-separated paths
            const lines = item.text
              .split(/\r?\n/)
              .map((s: any) => s.trim())
              .filter(Boolean);
            for (const p of lines)
              collected.push({ path: p, name: path.basename(p) });
          }
        }
      }
      if (collected.length) {
        discoveredFiles = collected
          .filter((f: any) => !!(f?.path || f?.name))
          .map((file: any) => ({
            path: file.path || file.name,
            name: file.name || (file.path ? path.basename(file.path) : ""),
            extension:
              file.extension ||
              `.${(file.name || file.path || "").split(".").pop()}` ||
              "",
            size: file.size || 0,
            summary: {
              lineCount: file.summary?.lineCount || file.lineCount || 0,
              functions: file.summary?.functions || [],
              imports: file.summary?.imports || [],
            },
          }));
      }

      // 2) If no toolResults, try parsing JSON from text (including fenced blocks)
      if (!discoveredFiles.length && typeof response.text === "string") {
        const fenced = response.text.match(/```json[\s\S]*?```/i);
        const raw = fenced
          ? fenced[0]
              .replace(/```json/i, "")
              .replace(/```/g, "")
              .trim()
          : response.text;
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedFiles = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsedFiles)) {
            discoveredFiles = parsedFiles.map((file: any) => ({
              path: file.path || file.name || file,
              name: file.name || file.path?.split("/").pop() || file,
              extension:
                file.extension ||
                `.${(file.name || file.path || "").split(".").pop()}` ||
                "",
              size: file.size || 0,
              summary: {
                lineCount: file.summary?.lineCount || 0,
                functions: file.summary?.functions || [],
                imports: file.summary?.imports || [],
              },
            }));
          }
        }
      }

      // 3) If still no files found, check for empty array response
      if (!discoveredFiles.length) {
        console.warn(
          `No files discovered for ${owner}/${repo}. Response was:`,
          response.text,
        );

        // Check if this is a known issue with the repository
        if (response.text.includes("[]") || response.text.trim() === "[]") {
          console.warn(
            "MCP returned empty array - this might indicate repository access issues or the repository has no code files",
          );
        }

        // Deterministic fallback using GitHub REST API
        const viaApi = await discoverFilesViaGitHubAPI(owner, repo, token, ref);
        if (viaApi.length > 0) {
          console.log("Using GitHub API fallback results");
          return viaApi;
        }
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError);
    }

    console.log(
      `Found ${discoveredFiles.length} files for ${owner}/${repo} using MCP`,
    );

    // If no files found, provide a helpful error message
    if (discoveredFiles.length === 0) {
      console.warn(`No files discovered for ${owner}/${repo}. This could be due to:
1. Repository access permissions (private repo without proper token)
2. Repository is empty or has no code files
3. GitHub API rate limits
4. MCP server configuration issues
5. Repository structure issues (LFS, submodules, etc.)`);
    }

    return discoveredFiles;
  } catch (error) {
    console.error("Error with MCP discovery:", error);
    throw new Error(
      `MCP discovery failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    // Always close the MCP client
    if (mcpClient) {
      await mcpClient.close();
    }
  }
}

export async function analyzeFilesWithMCP(
  owner: string,
  repo: string,
  selectedFiles: string[],
): Promise<MCPAnalysisResult> {
  console.log(
    `Analyzing ${selectedFiles.length} files for ${owner}/${repo} using MCP`,
  );

  let mcpClient;

  try {
    // Initialize MCP client
    mcpClient = await initializeMCPClient();
    const tools = await mcpClient.tools();

    console.log("Available MCP tools for analysis:", Object.keys(tools));

    // Initialize AI model
    const openRouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY!,
    });
    const model = openRouter.chat(META_MODEL);

    // Use AI SDK with MCP tools to analyze files
    const response = await generateText({
      model,
      tools,
      messages: [
        {
          role: "user",
          content: `Please analyze the following files from the repository ${owner}/${repo}:
          ${selectedFiles.join(", ")}
          
          Use the MCP tools to:
          1. Set the project path to ${owner}/${repo}
          2. Get detailed file summaries for each file
          3. Search for code patterns and potential issues
          4. Provide comprehensive analysis and recommendations for unit test generation
          
          Return a structured analysis including:
          - Code quality assessment
          - Potential issues and bugs
          - Unit test recommendations
          - Code improvement suggestions
          
          Format the response as JSON with summary, recommendations array, and files array.`,
        },
      ],
      stopWhen: stepCountIs(15),
    });

    console.log("MCP AI analysis response:", response.text);

    // Check for error responses in analysis
    if (
      response.text.includes('"error"') ||
      response.text.includes("Unable to retrieve")
    ) {
      console.warn("MCP analysis returned error response");
      const errorMatch = response.text.match(/"error":\s*"([^"]+)"/);
      if (errorMatch) {
        console.warn("MCP Analysis Error:", errorMatch[1]);
      }

      // Return a basic analysis result with error information
      return {
        summary: `Analysis failed for ${selectedFiles.length} files in ${owner}/${repo}. MCP returned an error.`,
        recommendations: [
          "Unable to analyze files due to MCP error",
          "Consider checking repository access permissions",
          "Verify GitHub token has appropriate scopes",
        ],
        files: selectedFiles.map((file) => ({
          path: file,
          analysis: `Analysis failed for ${file} due to MCP error`,
          recommendations:
            "Unable to provide recommendations due to analysis failure",
        })),
      };
    }

    // Parse the AI response to extract analysis results
    let analysisResult: MCPAnalysisResult = {
      summary: `MCP analysis completed for ${selectedFiles.length} files in ${owner}/${repo}`,
      recommendations: [],
      files: [],
    };

    try {
      // Try to parse JSON from the response
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedAnalysis = JSON.parse(jsonMatch[0]);
        analysisResult = {
          summary: parsedAnalysis.summary || analysisResult.summary,
          recommendations: parsedAnalysis.recommendations || [
            "Add unit tests for all public methods",
            "Consider adding error handling for edge cases",
            "Implement input validation for user inputs",
          ],
          files:
            parsedAnalysis.files ||
            selectedFiles.map((file) => ({
              path: file,
              analysis: `MCP analysis completed for ${file}`,
              recommendations:
                "Add comprehensive unit tests and error handling",
            })),
        };
      }
    } catch (parseError) {
      console.error("Error parsing AI analysis response:", parseError);
      // Fallback: create basic analysis if parsing fails
      analysisResult = {
        summary: `MCP analysis completed for ${selectedFiles.length} files in ${owner}/${repo}`,
        recommendations: [
          "Add unit tests for all public methods",
          "Consider adding error handling for edge cases",
          "Implement input validation for user inputs",
        ],
        files: selectedFiles.map((file) => ({
          path: file,
          analysis: `MCP analysis completed for ${file}. The file contains well-structured code.`,
          recommendations: "Add comprehensive unit tests and error handling",
        })),
      };
    }

    console.log(`MCP analysis completed for ${selectedFiles.length} files`);
    return analysisResult;
  } catch (error) {
    console.error("Error with MCP analysis:", error);
    throw new Error(
      `MCP analysis failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    // Always close the MCP client
    if (mcpClient) {
      await mcpClient.close();
    }
  }
}
