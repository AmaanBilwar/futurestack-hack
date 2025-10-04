import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { generateText } from "ai";

const openRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY!,
})

const model = openRouter.chat("meta-llama/llama-4-scout")

export async function performCodeReview(code: string, fileName?: string) {
    try {
        const { text } = await generateText({
            model: model,
            system: `You are an expert code reviewer. Analyze the provided code and provide a comprehensive review focusing on:

1. **Code Quality & Structure**
   - Code organization and readability
   - Naming conventions
   - Function/class design
   - Code complexity

2. **Potential Issues**
   - Bugs or logical errors
   - Security vulnerabilities
   - Performance concerns
   - Error handling

3. **Best Practices**
   - Language-specific best practices
   - Design patterns usage
   - Code maintainability

4. **Suggestions for Improvement**
   - Specific refactoring suggestions
   - Optimization opportunities
   - Better approaches

Provide a clear, actionable analysis that would help a developer improve the code.`,
            prompt: `Please analyze the following code${fileName ? ` from file: ${fileName}` : ''}:

\`\`\`
${code}
\`\`\`

Provide a comprehensive code review with specific, actionable feedback.`,
        });

        return text;
    } catch (error) {
        console.error('Code review error:', error);
        throw new Error("Failed to perform code review: " + (error instanceof Error ? error.message : "Unknown error"));
    }
}

export async function generateUnitTests(code: string, analysis: string, fileName?: string) {
    try {
        const { text } = await generateText({
            model: model,
            system: `You are an expert test engineer. Generate unit tests based on the provided code and its analysis.

IMPORTANT: Return ONLY the unit test code. Do not include any explanations, comments about the code, or additional text. Just return the pure unit test code that can be directly executed.

Your task is to:
1. Analyze the code structure and identify all testable functions/methods
2. Use the analysis notes to understand potential edge cases and issues
3. Generate comprehensive unit tests that cover:
   - Happy path scenarios
   - Edge cases and boundary conditions
   - Error handling
   - Any issues mentioned in the analysis
4. Include proper setup, teardown, and assertions
5. Use appropriate testing framework conventions

Generate tests that are:
- Comprehensive and thorough
- Well-structured and readable
- Include descriptive test names
- Cover both positive and negative test cases
- Address any specific concerns from the analysis

Return ONLY the executable unit test code.`,
            prompt: `Generate unit tests for the following code${fileName ? ` from file: ${fileName}` : ''}:

**Original Code:**
\`\`\`
${code}
\`\`\`

**Code Analysis Notes:**
${analysis}

Return ONLY the unit test code. Include imports, test setup, and all test cases. Do not include any explanations or additional text.`,
        });

        return text;
    } catch (error) {
        console.error('Unit test generation error:', error);
        throw new Error("Failed to generate unit tests: " + (error instanceof Error ? error.message : "Unknown error"));
    }
}