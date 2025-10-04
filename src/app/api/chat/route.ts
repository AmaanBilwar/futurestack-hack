import { performCodeReview } from "../code-reviewer";
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs
} from "ai";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";

const openRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

const model = openRouter.chat("meta-llama/llama-4-scout")

export const maxDuration = 30;

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  const {
    messages,
    sessionToken,
  }: { messages: UIMessage[]; sessionToken?: string } = await req.json();

  const result = streamText({
    model: model,
    system: ``,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      // Keep your existing custom tools
      codeReview: tool({
        description: "Review code and provide feedback",
        inputSchema: z.object({
          code: z.string().describe("The code to review"),
        }),
        execute: async ({ code}) => {
          try {
            const review = await performCodeReview(code)
            return {
              success: true,
              review,
              code: code
            }
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              code: code
            }
          }
        },
      }),
      unitTestWriting: tool({
        description: "Write unit tests for the code",
        inputSchema: z.object({
          code: z.string().describe("The code to write unit tests for"),
        }),
        execute: async ({ code }) => {
          return {
            code,
          };
        },
      }),
      dockerAgent: tool({
        description: "Create a docker agent",
        inputSchema: z.object({
          code: z.string().describe("The code to create a docker agent for"),
        }),
        execute: async ({ code }) => {
          return {
            code,
          };
        },
      }),
      resultsEvaluator: tool({
        description: "Evaluate the results from the sandbox env",
        inputSchema: z.object({
          results: z.string().describe("The results from the sandbox env"),
        }),
        execute: async ({ results }) => {
          return {
            results,
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
