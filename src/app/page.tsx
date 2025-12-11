"use client";

import { SignInButton, SignUpButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      redirect("/dashboard");
    }
  }, [isLoaded, isSignedIn]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Domain Manager</h1>
        <p className="text-muted-foreground text-lg max-w-md">
          Verwalte deine Domains und E-Mails an einem Ort. CSV Import, automatische Varianten-Suche und mehr.
        </p>
      </div>

      <SignedOut>
        <div className="flex gap-4">
          <SignInButton mode="modal">
            <button className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
              Anmelden
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
              Registrieren
            </button>
          </SignUpButton>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span>Weiterleitung zum Dashboard...</span>
        </div>
      </SignedIn>
    </div>
  );
}
