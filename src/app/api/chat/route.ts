import { streamText, UIMessage, convertToModelMessages } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
export const maxDuration = 30;

const model = process.env.META_MODEL;
console.log(model);
export async function POST(req: Request) {
  const { messages, code, analysis }: { messages: UIMessage[], code: string, analysis: string } = await req.json();

  const result = streamText({
    model: openrouter.chat(model!),
    messages: convertToModelMessages(messages),
    system: `Your context is basically the file user uploaded and the analysis of the file. use the ${code} and ${analysis} to help you answer the user's question.`,
  });

  return result.toUIMessageStreamResponse();
}
