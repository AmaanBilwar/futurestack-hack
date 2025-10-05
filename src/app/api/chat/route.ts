import { performCodeReview } from "../code-reviewer";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
  experimental_createMCPClient,
} from "ai";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";

const openRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const model = openRouter.chat("meta-llama/llama-4-scout");

export const maxDuration = 30;

// const codeIndexMCP = "https://glama.ai/mcp/instances/svuec7nlpl/mcp"
// const transport = new StdioClientTransport({
//   command: 'uvx',
//   args: ['code-index-mcp'],
// });

// const clientOne = await experimental_createMCPClient({
//   transport,
// });

// const toolSetOne = await clientOne.tools()
// const tools = {
//   ...toolSetOne
// }

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
  });

  return result.toUIMessageStreamResponse();
}
