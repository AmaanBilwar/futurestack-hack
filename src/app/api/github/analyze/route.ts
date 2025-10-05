import { NextRequest, NextResponse } from "next/server";
import { performCodeReview } from "../../code-reviewer";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { owner, repo, selectedFiles, token, ref } = await request.json();

    if (!owner || !repo || !selectedFiles || !token) {
      return NextResponse.json(
        { error: "Owner, repo, selectedFiles, and token are required" },
        { status: 400 },
      );
    }

    console.log(
      `Analyzing ${selectedFiles.length} files for ${owner}/${repo} using AI SDK`,
    );

    // Fetch file contents and analyze each file
    const analysisResults = [];
    
    for (const filePath of selectedFiles) {
      try {
        // Fetch file content from GitHub API
        const encodedPath = String(filePath)
          .split("/")
          .map((segment) => encodeURIComponent(segment))
          .join("/");
        const url = new URL(
          `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`,
        );
        if (ref) url.searchParams.set("ref", String(ref));
        const fileResponse = await fetch(url.toString(), {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "User-Agent": "codemarshall-analyzer",
          },
        });

        if (!fileResponse.ok) {
          console.warn(`Failed to fetch file ${filePath}:`, fileResponse.status);
          analysisResults.push({
            path: filePath,
            analysis: `Failed to fetch file content: ${fileResponse.status}`,
            recommendations: "Unable to analyze due to fetch error",
          });
          continue;
        }

        const fileData = await fileResponse.json();
        const fileContent = Buffer.from(fileData.content, "base64").toString(
          "utf-8",
        );

        // Use the existing performCodeReview function
        const analysis = await performCodeReview(fileContent, filePath);

        // Persist file and analysis to Convex
        const fileName = String(filePath).split("/").pop() || String(filePath);
        const extension = `.${fileName.split(".").pop()}`;
        const lines = fileContent.split(/\r?\n/).length;
        const characters = fileContent.length;

        let fileId;
        try {
          fileId = await convex.mutation(api.files.createFile, {
            name: fileName,
            content: fileContent,
            type: "text/plain",
            size: characters,
            userId: undefined,
            metadata: { extension, lines, characters },
          });
        } catch (e) {
          console.warn("Failed to create file record in Convex:", e);
        }

        if (fileId) {
          try {
            await convex.mutation(api.analyses.createAnalysis, {
              fileId,
              fileName,
              analysis,
              status: "completed",
              userId: undefined,
            });
          } catch (e) {
            console.warn("Failed to persist analysis in Convex:", e);
          }
        }

        analysisResults.push({
          path: filePath,
          analysis: analysis,
          recommendations:
            "Review the analysis above for specific recommendations",
        });

      } catch (fileError) {
        console.error(`Error analyzing file ${filePath}:`, fileError);
        analysisResults.push({
          path: filePath,
          analysis: `Error analyzing file: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
          recommendations: "Unable to provide recommendations due to analysis error",
        });
      }
    }

    // Create a summary
    const summary = `Analysis completed for ${analysisResults.length} files in ${owner}/${repo}. ${analysisResults.filter(r => !r.analysis.includes('Error') && !r.analysis.includes('Failed')).length} files analyzed successfully.`;

    const result = {
      summary,
      recommendations: [
        "Review each file's analysis for specific improvement suggestions",
        "Consider adding unit tests for the analyzed functions",
        "Address any security or performance concerns mentioned in the analysis",
      ],
      files: analysisResults,
    };

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Error analyzing files:", error);
    return NextResponse.json(
      { error: "Failed to analyze files" },
      { status: 500 },
    );
  }
}
