"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const session = authClient.useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: "/dashboard",
        scopes: ["repo", "read:org", "read:user", "user:email"],
      });
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your GitHub account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onSubmit} disabled={isLoading}>
            {isLoading ? "Signing in…" : "Sign in"}
          </Button>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
      {session.data ? <div>Signed in</div> : <div>Signed out</div>}
    </main>
  );
}
