"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";

const DASHBOARD_PATH = "/dashboard" as const;

const PUBLIC_PATHS = new Set<string>([
  "/", // sign-in page
]);

export default function AuthRedirect() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) return;
    if (!pathname) return;

    // Avoid redirect loops and skip API routes/next internals
    const isApiOrInternal =
      pathname.startsWith("/api") || pathname.startsWith("/_next");
    if (isApiOrInternal) return;

    // If already on dashboard, no-op
    if (pathname === DASHBOARD_PATH) return;

    // Only redirect if on a public path or any other non-dashboard path
    // This meets the requirement: if authenticated, always end up at dashboard
    router.replace(DASHBOARD_PATH);
  }, [isAuthenticated, isLoading, pathname, router]);

  return null;
}
