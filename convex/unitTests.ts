import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new unit test
export const createUnitTest = mutation({
  args: {
    fileId: v.id("files"),
    analysisId: v.id("analyses"),
    fileName: v.string(),
    unitTests: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("error")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const unitTestId = await ctx.db.insert("unitTests", {
      fileId: args.fileId,
      analysisId: args.analysisId,
      fileName: args.fileName,
      unitTests: args.unitTests,
      status: args.status,
      userId: args.userId,
      createdAt: Date.now(),
      completedAt: args.status === "completed" ? Date.now() : undefined,
    });
    return unitTestId;
  },
});

// Update unit test
export const updateUnitTest = mutation({
  args: {
    unitTestId: v.id("unitTests"),
    unitTests: v.optional(v.string()),
    status: v.optional(v.union(v.literal("pending"), v.literal("completed"), v.literal("error"))),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    
    if (args.unitTests !== undefined) {
      updates.unitTests = args.unitTests;
    }
    
    if (args.status !== undefined) {
      updates.status = args.status;
      if (args.status === "completed") {
        updates.completedAt = Date.now();
      }
    }

    await ctx.db.patch(args.unitTestId, updates);
  },
});

// Get unit test by ID
export const getUnitTest = query({
  args: { unitTestId: v.id("unitTests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.unitTestId);
  },
});

// Get unit tests for a file
export const getFileUnitTests = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("unitTests")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .order("desc")
      .collect();
  },
});

// Get unit tests for an analysis
export const getAnalysisUnitTests = query({
  args: { analysisId: v.id("analyses") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("unitTests")
      .withIndex("by_analysis", (q) => q.eq("analysisId", args.analysisId))
      .order("desc")
      .collect();
  },
});

// Get unit tests for a user
export const getUserUnitTests = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userId) return [];
    
    return await ctx.db
      .query("unitTests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get recent unit tests
export const getRecentUnitTests = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("unitTests")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});

// Delete unit test
export const deleteUnitTest = mutation({
  args: { unitTestId: v.id("unitTests") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.unitTestId);
  },
});
