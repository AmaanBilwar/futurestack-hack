import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { fileId, fileName, analysis, status, userId } = await request.json();

    // Create new analysis
    const analysisId = await convex.mutation(api.analyses.createAnalysis, {
      fileId,
      fileName,
      analysis,
      status: status || "completed",
      userId,
    });

    return NextResponse.json(
      {
        success: true,
        analysisId,
        message: "Analysis saved successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Create analysis API error:", error);
    return NextResponse.json(
      { error: "Failed to create analysis" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    const userId = searchParams.get("userId");
    const limit = searchParams.get("limit");

    let analyses;

    if (fileId) {
      analyses = await convex.query(api.analyses.getFileAnalyses, {
        fileId: fileId as any,
      });
    } else if (userId) {
      analyses = await convex.query(api.analyses.getUserAnalyses, {
        userId,
      });
    } else {
      analyses = await convex.query(api.analyses.getRecentAnalyses, {
        limit: limit ? parseInt(limit) : undefined,
      });
    }

    return NextResponse.json(
      {
        success: true,
        analyses: limit ? analyses.slice(0, parseInt(limit)) : analyses,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Get analyses API error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve analyses" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { analysisId, analysis, status } = await request.json();

    await convex.mutation(api.analyses.updateAnalysis, {
      analysisId,
      analysis,
      status,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Analysis updated successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Update analysis API error:", error);
    return NextResponse.json(
      { error: "Failed to update analysis" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get("analysisId");

    if (!analysisId) {
      return NextResponse.json(
        { error: "Analysis ID is required" },
        { status: 400 },
      );
    }

    await convex.mutation(api.analyses.deleteAnalysis, {
      analysisId: analysisId as any,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Analysis deleted successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Delete analysis API error:", error);
    return NextResponse.json(
      { error: "Failed to delete analysis" },
      { status: 500 },
    );
  }
}
