import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // File storage table
  files: defineTable({
    name: v.string(),
    storageId: v.id("_storage"),
    type: v.string(),
    size: v.number(),
    userId: v.optional(v.string()),
    uploadedAt: v.number(),
    metadata: v.optional(v.object({
      language: v.optional(v.string()),
      extension: v.optional(v.string()),
      lines: v.optional(v.number()),
      characters: v.optional(v.number()),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_uploaded_at", ["uploadedAt"])
    .index("by_user_and_date", ["userId", "uploadedAt"]),

  // Analysis results table
  analyses: defineTable({
    fileId: v.id("files"),
    fileName: v.string(),
    analysis: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("error")),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    userId: v.optional(v.string()),
  })
    .index("by_file", ["fileId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"]),

  // Unit test results table
  unitTests: defineTable({
    fileId: v.id("files"),
    analysisId: v.id("analyses"),
    fileName: v.string(),
    unitTests: v.string(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("error")),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    userId: v.optional(v.string()),
  })
    .index("by_file", ["fileId"])
    .index("by_analysis", ["analysisId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"]),

  // Project sessions table - groups files, analyses, and tests together
  sessions: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("archived")),
    metadata: v.optional(v.object({
      fileCount: v.optional(v.number()),
      analysisCount: v.optional(v.number()),
      testCount: v.optional(v.number()),
      sourceType: v.optional(v.union(v.literal("upload"), v.literal("github"))),
      githubRepo: v.optional(v.string()),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"])
    .index("by_user_and_status", ["userId", "status"]),

  // Session files junction table
  sessionFiles: defineTable({
    sessionId: v.id("sessions"),
    fileId: v.id("files"),
    addedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_file", ["fileId"])
    .index("by_session_and_file", ["sessionId", "fileId"]),

  // User preferences and settings
  userSettings: defineTable({
    userId: v.string(),
    preferences: v.object({
      autoAnalyze: v.optional(v.boolean()),
      autoGenerateTests: v.optional(v.boolean()),
      defaultLanguage: v.optional(v.string()),
      theme: v.optional(v.string()),
    }),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),
});
