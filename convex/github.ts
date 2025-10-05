import { query } from "./_generated/server";
import { authComponent } from "./auth";
import { components } from "./_generated/api";

// Query to get the current user's GitHub access token
export const getGithubToken = query({
  args: {},
  handler: async (ctx) => {
    // Get the current authenticated user
    const user = await authComponent.getAuthUser(ctx);
    if (!user) {
      return null;
    }

    try {
      // Query the betterAuth component for GitHub account using the adapter
      const account = await ctx.runQuery(
        components.betterAuth.adapter.findOne,
        {
          model: "account",
          where: [
            {
              field: "userId",
              operator: "eq",
              value: user._id,
            },
            {
              field: "providerId",
              operator: "eq",
              value: "github",
            },
          ],
        },
      );

      return account?.accessToken ?? null;
    } catch (error) {
      console.error("Error fetching GitHub token:", error);
      return null;
    }
  },
});
