import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, stepCountIs } from "ai";
import { ConvexHttpClient } from "convex/browser";

const META_MODEL = process.env.META_MODEL!;

const openRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const model = openRouter.chat(META_MODEL);

export const maxDuration = 30;

// Initialize Convex client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function detectLanguage(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) return "javascript";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".rb")) return "ruby";
  if (lower.endsWith(".cs")) return "csharp";
  return "";
}

function buildSystemPrompt(fileName: string): string {
  const lang = detectLanguage(fileName);
  const frameworkHint =
    lang === "python"
      ? "Use the built-in 'unittest' framework."
      : lang === "typescript" || lang === "javascript"
        ? "Use Jest. Include necessary imports/setup so the file runs as-is."
        : lang === "go"
          ? "Use the 'testing' package and name the file with _test.go style."
          : lang === "java"
            ? "Use JUnit 5 with appropriate annotations."
            : lang === "ruby"
              ? "Use RSpec with a self-contained spec file."
              : lang === "csharp"
                ? "Use xUnit with a compilable test class."
                : "Choose a common, runnable testing framework for the language.";

  return `You are an expert unit test generator. Generate comprehensive unit tests for the provided code based on the analysis. Focus on:
- Testing all public methods and functions
- Edge cases and error conditions
- Input validation
- Expected behavior scenarios
- Include setup and teardown if needed

Strict output rules (must follow exactly):
- Output ONLY a single fenced code block containing executable test code for ${lang || "the target language"}.
- Do NOT include any prose, headings, bullet points, or explanations before or after the code block.
- The code must be directly runnable by the standard test runner for the chosen framework.
- ${frameworkHint}`;
}

function extractExecutableCode(raw: string, fileName: string): string {
  if (!raw) return "";
  const preferredLang = detectLanguage(fileName);

  // Collect fenced code blocks
  const codeFenceRegex = /```(?:\s*([a-zA-Z0-9_+\-]+))?\s*\n([\s\S]*?)```/g;
  const blocks: { lang: string; content: string; score: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = codeFenceRegex.exec(raw)) !== null) {
    const lang = (match[1] || "").toLowerCase();
    const content = match[2] || "";
    let score = content.length;
    if (preferredLang && lang === preferredLang) score += 1000;
    // Light heuristics by language
    if (preferredLang === "python") {
      if (/import\s+unittest/.test(content)) score += 300;
      if (/class\s+Test/.test(content)) score += 150;
      if (/def\s+test_/.test(content)) score += 150;
    }
    if (preferredLang === "typescript" || preferredLang === "javascript") {
      if (/describe\(/.test(content)) score += 200;
      if (/it\(/.test(content) || /test\(/.test(content)) score += 200;
      if (/jest\./.test(content)) score += 100;
    }
    blocks.push({ lang, content, score });
  }

  if (blocks.length > 0) {
    blocks.sort((a, b) => b.score - a.score);
    return blocks[0]!.content.trim();
  }

  // If no fenced code blocks, try to strip obvious markdown and keep code-like content
  const lines = raw.split(/\r?\n/);
  const filtered = lines.filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (t.startsWith("#")) return false;
    if (/^[-*]\s/.test(t)) return false; // bullets
    if (/^```/.test(t)) return false;
    if (/^>{1,}/.test(t)) return false; // blockquote
    if (/^=+$/.test(t) || /^-+$/.test(t)) return false; // underlines
    if (/^\d+\./.test(t)) return false; // numbered list
    return true;
  });
  const cleaned = filtered.join("\n").trim();
  return cleaned;
}

export async function POST(req: Request) {
  try {
    const {
      code,
      analysis,
      fileName,
      runTests = false,
    }: {
      code: string;
      analysis: string;
      fileName: string;
      runTests?: boolean;
    } = await req.json();

    // Validate required fields
    if (!code || !analysis || !fileName) {
      return new Response(
        JSON.stringify({ error: "code, analysis, and fileName are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await generateText({
      model: model,
      system: buildSystemPrompt(fileName),
      messages: [
        {
          role: "user",
          content: `Generate unit tests for the following code:

**File:** ${fileName}
**Code:**
\`\`\`
${code}
\`\`\`

**Analysis:**
${analysis}

Please generate comprehensive unit tests that cover the functionality described in the analysis. Output must be a single fenced code block as per the rules.`,
        },
      ],
      stopWhen: stepCountIs(5),
    });

    // Get the full text from the response
    const { text } = result;

    console.log("Text property:", text);
    console.log("Text type:", typeof text);

    // Ensure text is a string
    const unitTestsText = typeof text === "string" ? text : String(text || "");

    console.log("Final unit tests text:", unitTestsText);

    const cleaned = extractExecutableCode(unitTestsText, fileName);

    return new Response(
      JSON.stringify({
        unitTests: cleaned,
        success: true,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in unit-tests route:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process unit test generation request",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
