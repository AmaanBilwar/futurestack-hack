// Load environment variables from .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

// Check environment variables for GitHub MCP integration
console.log("Environment Check:");
console.log(
  "NEXT_PUBLIC_CONVEX_URL:",
  process.env.NEXT_PUBLIC_CONVEX_URL ? "✅ Set" : "❌ Missing",
);
console.log(
  "GITHUB_CLIENT_ID:",
  process.env.GITHUB_CLIENT_ID ? "✅ Set" : "❌ Missing",
);
console.log(
  "GITHUB_CLIENT_SECRET:",
  process.env.GITHUB_CLIENT_SECRET ? "✅ Set" : "❌ Missing",
);

// Check if Convex functions are available
try {
  const { api } = require("../convex/_generated/api");
  console.log(
    "Convex API:",
    api.github
      ? "✅ GitHub functions available"
      : "❌ GitHub functions missing",
  );
  if (api.github) {
    console.log("Available GitHub functions:", Object.keys(api.github));
  }
} catch (error) {
  console.log(
    "❌ Convex API not available:",
    error instanceof Error ? error.message : String(error),
  );
}
