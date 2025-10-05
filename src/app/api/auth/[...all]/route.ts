import { nextJsHandler } from "@convex-dev/better-auth/nextjs";

const CONVEX_SITE_URL =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL!
  // process.env.NEXT_PUBLIC_CONVEX_URL ??
  // process.env.CONVEX_SITE_URL;

export const { GET, POST } = nextJsHandler({ convexSiteUrl: CONVEX_SITE_URL });
