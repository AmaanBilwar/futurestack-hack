import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generate an upload URL for file uploads
export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Create a new file with storage ID
export const saveFileWithStorageId = mutation({
  args: {
    name: v.string(),
    storageId: v.id("_storage"),
    type: v.string(),
    size: v.number(),
    userId: v.optional(v.string()),
    metadata: v.optional(v.object({
      language: v.optional(v.string()),
      extension: v.optional(v.string()),
      lines: v.optional(v.number()),
      characters: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const fileId = await ctx.db.insert("files", {
      name: args.name,
      storageId: args.storageId,
      type: args.type,
      size: args.size,
      userId: args.userId,
      uploadedAt: Date.now(),
      metadata: args.metadata,
    });
    return fileId;
  },
});

// Legacy createFile function for backward compatibility (deprecated)
export const createFile = mutation({
  args: {
    name: v.string(),
    content: v.string(),
    type: v.string(),
    size: v.number(),
    userId: v.optional(v.string()),
    metadata: v.optional(v.object({
      language: v.optional(v.string()),
      extension: v.optional(v.string()),
      lines: v.optional(v.number()),
      characters: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    // TODO: Fix storage API - temporarily using a placeholder storage ID
    const storageId = "placeholder" as any;
    
    const fileId = await ctx.db.insert("files", {
      name: args.name,
      storageId: storageId,
      type: args.type,
      size: args.size,
      userId: args.userId,
      uploadedAt: Date.now(),
      metadata: args.metadata,
    });
    return fileId;
  },
});

// Get file by ID
export const getFile = query({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.fileId);
  },
});

// Get file content from storage
export const getFileContent = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    // TODO: Fix storage API - temporarily returning null
    return null;
  },
});

// Get file URL for serving
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Get all files for a user
export const getUserFiles = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.userId) return [];
    
    return await ctx.db
      .query("files")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get recent files (last 50)
export const getRecentFiles = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("files")
      .withIndex("by_uploaded_at")
      .order("desc")
      .take(limit);
  },
});

// Delete a file
export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    // Also delete related analyses and unit tests
    const analyses = await ctx.db
      .query("analyses")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .collect();
    
    const unitTests = await ctx.db
      .query("unitTests")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .collect();

    // Delete related records
    for (const analysis of analyses) {
      await ctx.db.delete(analysis._id);
    }
    
    for (const unitTest of unitTests) {
      await ctx.db.delete(unitTest._id);
    }

    // Delete session file relationships
    const sessionFiles = await ctx.db
      .query("sessionFiles")
      .withIndex("by_file", (q) => q.eq("fileId", args.fileId))
      .collect();
    
    for (const sessionFile of sessionFiles) {
      await ctx.db.delete(sessionFile._id);
    }

    // Finally delete the file
    await ctx.db.delete(args.fileId);
  },
});

// Update file metadata
export const updateFileMetadata = mutation({
  args: {
    fileId: v.id("files"),
    metadata: v.object({
      language: v.optional(v.string()),
      extension: v.optional(v.string()),
      lines: v.optional(v.number()),
      characters: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.fileId, {
      metadata: args.metadata,
    });
  },
});

// Search files by name or content
export const searchFiles = query({
  args: {
    query: v.string(),
    userId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const searchTerm = args.query.toLowerCase();
    
    let allFiles;
    
    if (args.userId) {
      allFiles = await ctx.db
        .query("files")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
    } else {
      allFiles = await ctx.db
        .query("files")
        .withIndex("by_uploaded_at")
        .collect();
    }
    
    // Filter files by name containing the search term
    const filteredFiles = allFiles.filter(file => 
      file.name.toLowerCase().includes(searchTerm)
    );
    
    return filteredFiles
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .slice(0, limit);
  },
});
