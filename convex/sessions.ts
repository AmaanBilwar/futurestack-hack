import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new session
export const createSession = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.optional(v.string()),
    metadata: v.optional(v.object({
      fileCount: v.optional(v.number()),
      analysisCount: v.optional(v.number()),
      testCount: v.optional(v.number()),
      sourceType: v.optional(v.union(v.literal("upload"), v.literal("github"))),
      githubRepo: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const sessionId = await ctx.db.insert("sessions", {
      name: args.name,
      description: args.description,
      userId: args.userId,
      createdAt: now,
      updatedAt: now,
      status: "active",
      metadata: args.metadata || {},
    });
    return sessionId;
  },
});

// Get session by ID
export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

// Get all sessions for a user
export const getUserSessions = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userId) return [];
    
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get active sessions for a user
export const getActiveSessions = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userId) return [];
    
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_and_status", (q) => 
        q.eq("userId", args.userId).eq("status", "active")
      )
      .order("desc")
      .collect();
  },
});

// Get session with files
export const getSessionWithFiles = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    // Get session files
    const sessionFiles = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    // Get file details
    const files = await Promise.all(
      sessionFiles.map(async (sessionFile) => {
        const file = await ctx.db.get(sessionFile.fileId);
        return file ? { ...file, addedAt: sessionFile.addedAt } : null;
      })
    );

    // Get analyses for files in this session
    const analyses = await Promise.all(
      files.map(async (file) => {
        if (!file) return null;
        const analysis = await ctx.db
          .query("analyses")
          .withIndex("by_file", (q) => q.eq("fileId", file._id))
          .order("desc")
          .first();
        return analysis;
      })
    );

    // Get unit tests for analyses in this session
    const unitTests = await Promise.all(
      analyses.map(async (analysis) => {
        if (!analysis) return null;
        const unitTest = await ctx.db
          .query("unitTests")
          .withIndex("by_analysis", (q) => q.eq("analysisId", analysis._id))
          .order("desc")
          .first();
        return unitTest;
      })
    );

    return {
      session,
      files: files.filter(Boolean),
      analyses: analyses.filter(Boolean),
      unitTests: unitTests.filter(Boolean),
    };
  },
});

// Add file to session
export const addFileToSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    // Check if file is already in session
    const existing = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session_and_file", (q) => 
        q.eq("sessionId", args.sessionId).eq("fileId", args.fileId)
      )
      .first();

    if (existing) {
      return existing._id; // File already in session
    }

    // Add file to session
    const sessionFileId = await ctx.db.insert("sessionFiles", {
      sessionId: args.sessionId,
      fileId: args.fileId,
      addedAt: Date.now(),
    });

    // Update session metadata
    const session = await ctx.db.get(args.sessionId);
    if (session) {
      const fileCount = (await ctx.db
        .query("sessionFiles")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .collect()).length;

      await ctx.db.patch(args.sessionId, {
        updatedAt: Date.now(),
        metadata: {
          ...session.metadata,
          fileCount,
        },
      });
    }

    return sessionFileId;
  },
});

// Remove file from session
export const removeFileFromSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    fileId: v.id("files"),
  },
  handler: async (ctx, args) => {
    const sessionFile = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session_and_file", (q) => 
        q.eq("sessionId", args.sessionId).eq("fileId", args.fileId)
      )
      .first();

    if (sessionFile) {
      await ctx.db.delete(sessionFile._id);

      // Update session metadata
      const session = await ctx.db.get(args.sessionId);
      if (session) {
        const fileCount = (await ctx.db
          .query("sessionFiles")
          .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
          .collect()).length;

        await ctx.db.patch(args.sessionId, {
          updatedAt: Date.now(),
          metadata: {
            ...session.metadata,
            fileCount,
          },
        });
      }
    }
  },
});

// Update session
export const updateSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("completed"), v.literal("archived"))),
    metadata: v.optional(v.object({
      fileCount: v.optional(v.number()),
      analysisCount: v.optional(v.number()),
      testCount: v.optional(v.number()),
      sourceType: v.optional(v.union(v.literal("upload"), v.literal("github"))),
      githubRepo: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const { sessionId, ...updates } = args;
    
    await ctx.db.patch(sessionId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Delete session
export const deleteSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    // Delete session files relationships
    const sessionFiles = await ctx.db
      .query("sessionFiles")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const sessionFile of sessionFiles) {
      await ctx.db.delete(sessionFile._id);
    }

    // Delete the session
    await ctx.db.delete(args.sessionId);
  },
});

// Get session history (recent sessions)
export const getSessionHistory = query({
  args: {
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    if (!args.userId) {
      return await ctx.db
        .query("sessions")
        .withIndex("by_created_at")
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});
