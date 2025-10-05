## CodeMarshall

Your AI-assisted code review, unit-test generation, and automated refactoring workflow — designed to slash review toil so developers can focus on shipping.



### Why this matters (Potential Impact)
- **Problem**: Developers spend significant time reading, reviewing, and writing tests — work that is critical but repetitive and slow.
- **My goal**: Cut the time spent on review and test authoring by up to **80%**, helping solo devs, teams, and “vibe coders” catch bugs earlier and iterate faster.
- **Who benefits**: Any developer or team reviewing code across repos, particularly those wanting quick, actionable analyses and test coverage without changing their stack.

### What CodeMarshall does (Creativity & Originality)
- **Selective GitHub analysis**: Pick a repo/branch, select files, and get per‑file AI analysis and recommendations.
- **Unit test generation**: Produce framework‑appropriate unit tests from analyses. (Execution in a sandbox is on the roadmap.)
- **Automated refactors (working today)**: Apply refactor suggestions via GitHub MCP tooling to generate ready‑to‑use refactored files.
- **Chat on results**: A lightweight chat UI to discuss analyses and next steps.
- **Sessions & history**: Logical grouping of analyses for repeatable workflows.

### How it works (Technical Implementation)
- **Frontend**: Next.js 15 + React 19, modern UI components, and a step‑based dashboard UX.
- **Backend**: A pragmatic mix of TypeScript endpoints and Convex functions for analysis/session orchestration.
- **AI stack**: Vercel AI SDK over OpenRouter using the `llama-4-scout` model for fast, strong reasoning.
- **Refactoring**: Uses GitHub MCP to apply refactor suggestions and return full refactored file contents.
- **Design choices**: Intentionally simple service boundaries to keep iteration fast, while leaving headroom for sandboxed execution and CI integrations.

### Current feature set
- Sign in with GitHub and land on the dashboard.
- Discover and select files from your GitHub repositories (with branch selection) or upload files directly.
- Run AI code reviews that include structured recommendations and a dedicated "Refactor Suggestions" section.
- Generate unit tests from the analysis, tailored to language/framework conventions.
- Apply refactors to produce full refactored files you can download and use.
- Chat UI exists to interact around the results and next steps.

### What’s next (Roadmap)
- Run generated unit tests in a secure microsandbox powered by CodeSandbox (with Docker support) and report pass/fail plus logs.
- One‑click deployments with container orchestration for teams.
- PR‑level review workflows and inline comments on GitHub.
- Optional MCP server so other clients can use CodeMarshall capabilities.
- Configurable model selection and fine‑tuned variants.

### Setup

#### Requirements
- Node.js 20+
- A GitHub account (for OAuth)
- OpenRouter API key

#### Environment variables
Create a `.env.local` file in the project root with:

```env
SITE_URL=http://localhost:3000
CONVEX_SITE_URL=http://localhost:3000

# Convex
# Example dev deployment: dev:your-deployment-name
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=
NEXT_PUBLIC_CONVEX_SITE_URL=

# Better Auth (generate a strong random 32-byte base64 string)
BETTER_AUTH_SECRET=replace-with-random-32-bytes-base64

# GitHub OAuth (must match the GitHub OAuth App for this environment)
# For local GitHub app: Authorization callback URL must be:
#   http://localhost:3000/api/auth/callback/github
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Optional: Personal Access Token (refer to github mcp docs to know more)
GITHUB_PAT=

# AI providers (set whichever you use)
OPENROUTER_API_KEY=

# MorphLLM
MORPHLLM_API_KEY=

# Default model selection
META_MODEL=meta-llama/llama-4-scout
```


Note: This is an open-source project. Teams may self‑host and plug in their own auth config as needed.

> you might need to follow the Github MCP Server README for additional help, in case the github mcp doesnt work correctly. Sometimes, you need to add a Personal access token from github & pull the docker image for the Github MCP server. 
#### Install & run locally
```bash
npm install # or pnpm install / yarn
npm dev     # starts Next.js with Turbopack
```

Open `http://localhost:3000` and sign in with GitHub.

### Local testing walkthrough
1. Sign in with GitHub.
2. Choose input method:
   - GitHub: select repository → select branch → search/filter files → select files.
   - Upload: add one or more code files.
3. Click “Continue to Code Review” to generate analyses per file.
4. Generate unit tests from the completed analyses and download them.
5. Apply refactors to receive full refactored file contents and download.
6. Use the chat UI to ask follow‑ups about results.

### Security, privacy, and scope
- Source code you select is sent to the AI provider for analysis/refactoring and to GitHub MCP for refactor application.
- This repository is open source and intended for self‑hosting in personal or enterprise environments.

### Aesthetics & UX
- Step‑based flow: Upload/Select → Analyze → Generate Tests → Refactor → Chat.
- File discovery with fuzzy search, pagination, and branch awareness for GitHub repos.
- Clear per‑file analysis and test output presentation with easy download actions.

### Learning & Growth
- Built by a solo developer focused on practical developer productivity.
- Emphasis on simple, composable technologies to attack a ubiquitous pain point.

### Tech stack
- Next.js 15, React 19, Tailwind UI components
- Vercel AI SDK + OpenRouter (`llama-4-scout`)
- Convex (functions + schema)
- GitHub MCP for refactor application

### Live demo
- Visit the deployed app: [codemarshall.onrender.com](https://codemarshall.onrender.com)

> chances are this deployment isnt working because vercel and github are not friends, so youre gonna have to test it our locally. Sorry for the inconvenience, but I cant do much if Github cant solve 2 year old issues with OAuth apps  
### Acknowledgements
- Thanks to the broader OSS ecosystem, Vercel AI SDK, OpenRouter, and Convex for enabling rapid iteration.

---

If you have feedback or want to contribute, feel free to open an issue or PR.

