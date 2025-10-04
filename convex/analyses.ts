import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new analysis
export const createAnalysis = mutation({
  args: {
    fileId: v.id("files"),
    fileName: v.string(),
    analysis: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("error")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const analysisId = await ctx.db.insert("analyses", {
      fileId: args.fileId,
      fileName: args.fileName,
      analysis: args.analysis,
      status: args.status,
      userId: args.userId,
      createdAt: Date.now(),
      completedAt: args.status === "completed" ? Date.now() : undefined,
    });
    return analysisId;
  },
});

// Update analysis
export const updateAnalysis = mutation({
  args: {
    analysisId: v.id("analyses"),
    analysis: v.optional(v.string()),
    status: v.optional(v.union(v.literal("pending"), v.literal("completed"), v.literal("error"))),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    
    if (args.analysis !== undefined) {
      updates.analysis = args.analysis;
    }
    
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "completed") {
        updates.completedAt = Date.now();
      }
    }

    await ctx.db.patch(args.analysisId, updates);
  },
});

// Get analysis by ID
export const getAnalysis = query({
  args: { analysisId: v.id("analyses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.analysisId);
  },
});

// Get analyses for a file
export const getFileAnalyses = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analyses")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .order("desc")
      .collect();
  },
});

// Get analyses for a user
export const getUserAnalyses = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userId) return [];
    
    return await ctx.db
      .query("analyses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get recent analyses
export const getRecentAnalyses = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("analyses")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});

// Delete analysis
export const deleteAnalysis = mutation({
  args: { analysisId: v.id("analyses") },
  handler: async (ctx, args) => {
    // Also delete related unit tests
    const unitTests = await ctx.db
      .query("unitTests")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .collect();

    for (const unitTest of unitTests) {
      await ctx.db.delete(unitTest._id);
    }

    await ctx.db.delete(args.analysisId);
  },
});
