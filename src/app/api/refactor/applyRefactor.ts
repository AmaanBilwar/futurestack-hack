import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const openRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
});

const META_MODEL = process.env.META_MODEL!;
const model = openRouter.chat(META_MODEL);

export async function applyRefactor(
  code: string,
  analysisOrSuggestions: string,
  fileName?: string,
  refactoredTargetPath?: string,
) {
  // Try to initialize Morph Fast Apply MCP client if available. If not, we still proceed.
  let tools: any = undefined;
  try {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["@morph-llm/morph-fast-apply"],
      env: {
        MORPH_API_KEY: process.env.MORPHLLM_API_KEY || "",
        ALL_TOOLS: "true",
      },
    });
    const mcpClient = await createMCPClient({ transport });
    tools = await mcpClient.tools();
  } catch (e) {
    // Best-effort: continue without MCP tools
    console.warn("Morph MCP tools unavailable, continuing without tools.");
  }

  try {
    const { text } = await generateText({
      model,
      tools,
      system: [
        // Morph Fast Apply edit_file tool usage guidance (Context7 summary embedded)
        "You can use an edit_file tool to perform precise code edits.",
        "When using edit_file:",
        "- Provide target_file (string): which file to modify.",
        "- Provide instructions (string): a single first-person sentence explaining what you are changing to disambiguate.",
        "- Provide code_edit (string): It MUST contain the FULL, FINAL FILE CONTENTS. Do NOT use placeholders like '// ... existing code ...', '... existing code ...', or diff markers.",
        "If creating a new refactored file, set target_file to the provided path and include the full file contents in one code_edit block.",
        "If tools are unavailable, output ONLY the full refactored file contents — no headings, no steps, no explanations, no markdown fences.",
      ].join("\n"),
      prompt: [
        `Refactor the provided source code${fileName ? ` from file: ${fileName}` : ""} by applying the explicit refactor suggestions below.`,
        "Return ONLY one of the following:",
        "1) A single edit_file tool call creating a new refactored file; or",
        "2) If tools are unavailable, ONLY the full refactored file contents (no steps, no commentary, no fences).",
        "MANDATORY RULES:",
        "- The refactored output must be the FULL, self-contained file contents.",
        "- Do NOT include placeholders such as '// ... existing code ...', '/* ... existing code ... */', or '...'.",
        "- Do NOT output unified diffs or partial hunks (no lines starting with '+' or '-' or '@@').",
        refactoredTargetPath
          ? `\nMANDATORY: Use edit_file.target_file = ${refactoredTargetPath}`
          : "",
        "\n---\nRefactor Suggestions (authoritative):\n",
        analysisOrSuggestions,
        "\n---\nOriginal Code:\n",
        code,
      ].join("\n"),
      temperature: 0,
    });

    // Prefer extracting from raw text so we can detect fenced blocks and validate full contents.
    return extractRefactoredContents(text, code);
  } catch (error) {
    console.error("Refactor error:", error);
    throw new Error(
      "Failed to apply refactor: " +
        (error instanceof Error ? error.message : "Unknown error"),
    );
  }
}

function cleanMarkdownSyntax(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/gm, "");
  cleaned = cleaned.replace(/\n?```$/gm, "");
  cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/gm, "");
  return cleaned.trim();
}

function isLikelyPartial(content: string, originalLines?: number): boolean {
  const hasPlaceholder = /\.\.\.\s*existing code\s*\.\.\.|\/\/\s*\.\.\.\s*existing code|\/\*\s*\.\.\.\s*existing code\s*\*\//i.test(
    content,
  );
  const hasDiffMarkers = /^(\+|\-|@@)/m.test(content);
  const mentionsEditFile = /code_edit\s*\=|edit_file\./i.test(content);
  const tooShort =
    typeof originalLines === "number" && originalLines > 0
      ? content.split(/\r?\n/).length < Math.max(10, Math.floor(originalLines * 0.4))
      : false;
  return hasPlaceholder || hasDiffMarkers || mentionsEditFile || !!tooShort;
}

function extractRefactoredContents(text: string, originalCode?: string): string {
  if (!text) return "";

  // 1) If model returned an edit_file call, extract code_edit contents (support both triple double/single quotes)
  const tripleDouble = /code_edit\s*=\s*"""([\s\S]*?)"""/;
  const tripleSingle = /code_edit\s*=\s*'''([\s\S]*?)'''/;
  let match = text.match(tripleDouble) || text.match(tripleSingle);
  if (match && match[1]) {
    const candidate = match[1].trim();
    if (!isLikelyPartial(candidate, originalCode?.split(/\r?\n/).length)) {
      return candidate;
    }
    // If likely partial, continue searching for a better candidate.
  }

  // 1b) Sometimes code_edit appears with additional property syntax; grab the first triple-quoted block after the code_edit token
  const codeEditIndex = text.indexOf("code_edit");
  if (codeEditIndex !== -1) {
    const after = text.slice(codeEditIndex);
    const anyTriple = after.match(/("""|''')([\s\S]*?)\1/);
    if (anyTriple && anyTriple[2]) {
      const candidate = anyTriple[2].trim();
      if (!isLikelyPartial(candidate, originalCode?.split(/\r?\n/).length)) {
        return candidate;
      }
    }
  }

  // 2) Try fenced code blocks (prefer the longest block as most likely full file)
  const fenceRegex = /```[a-zA-Z]*\n([\s\S]*?)```/g;
  let fenceMatch: RegExpExecArray | null;
  let bestBlock = "";
  while ((fenceMatch = fenceRegex.exec(text)) !== null) {
    const block = fenceMatch[1].trim();
    if (
      block.length > bestBlock.length &&
      !isLikelyPartial(block, originalCode?.split(/\r?\n/).length)
    ) {
      bestBlock = block;
    }
  }
  if (bestBlock) return bestBlock;

  // 3) Try after a marker like "Here's the refactored code:" up to the end
  const markerIdx = text.toLowerCase().indexOf("here's the refactored code");
  if (markerIdx !== -1) {
    const after = text.slice(markerIdx);
    // drop the marker line
    const lines = after.split(/\r?\n/).slice(1);
    // stop if a new section begins (e.g., starts with ## or [edit_file)
    const collected: string[] = [];
    for (const line of lines) {
      if (/^##\s|^\[edit_file/i.test(line)) break;
      collected.push(line);
    }
    const candidate = collected.join("\n").trim();
    if (candidate && !isLikelyPartial(candidate, originalCode?.split(/\r?\n/).length)) {
      return candidate;
    }
  }

  // 4) Fallback: return the whole text (cleaned of fences) minus obvious step headings
  const filtered = cleanMarkdownSyntax(text)
    .split(/\r?\n/)
    .filter(
      (l) =>
        // Drop headings and enumerations
        !/^\s*#{1,6}\s/.test(l) &&
        !/^\s*\d+\./.test(l) &&
        // Drop obvious wrapper lines if the tool call leaked
        !/^\s*import\s+edit_file/.test(l) &&
        !/^\s*edit_file\./.test(l),
    )
    .join("\n")
    .trim();
  return filtered;
}
