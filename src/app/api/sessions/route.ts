import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { name, description, userId, metadata } = await request.json();

    // Create new session
    const sessionId = await convex.mutation(api.sessions.createSession, {
      name,
      description,
      userId,
      metadata,
    });

    return NextResponse.json(
      {
        success: true,
        sessionId,
        message: "Session created successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Create session API error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = searchParams.get("limit");

    const sessions = await convex.query(api.sessions.getSessionHistory, {
      userId: userId || undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        sessions,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Get sessions API error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve sessions" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { sessionId, ...updates } = await request.json();

    await convex.mutation(api.sessions.updateSession, {
      sessionId,
      ...updates,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Session updated successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Update session API error:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    await convex.mutation(api.sessions.deleteSession, {
      sessionId: sessionId as any,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Session deleted successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Delete session API error:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 },
    );
  }
}
