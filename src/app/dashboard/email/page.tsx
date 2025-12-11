"use client";

import { useState } from "react";
import { MailIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { setupEmailForwardAll } from "@/lib/api";

export default function EmailPage() {
  const [bulkEmailTarget, setBulkEmailTarget] = useState("");
  const [bulkEmailLoading, setBulkEmailLoading] = useState(false);

  const handleBulkEmailForward = async () => {
    if (!bulkEmailTarget) return;
    setBulkEmailLoading(true);
    try {
      await setupEmailForwardAll(bulkEmailTarget);
      alert(`Email-Weiterleitung fuer alle Domains auf ${bulkEmailTarget} eingerichtet!`);
    } catch (err) {
      alert(`Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`);
    } finally {
      setBulkEmailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Weiterleitung</h2>
        <p className="text-muted-foreground">
          Richte info@ Weiterleitung fuer alle deine Domains ein.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email-Weiterleitung fuer alle Domains</CardTitle>
          <CardDescription>
            Richte info@ Weiterleitung fuer alle deine Domains ein. Dynadot setzt automatisch die MX-Records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="bulk-email">Ziel-Email</Label>
              <Input
                id="bulk-email"
                type="email"
                placeholder="deine@email.de"
                value={bulkEmailTarget}
                onChange={(e) => setBulkEmailTarget(e.target.value)}
              />
            </div>
            <Button
              onClick={handleBulkEmailForward}
              disabled={!bulkEmailTarget || bulkEmailLoading}
            >
              {bulkEmailLoading ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MailIcon className="mr-2 h-4 w-4" />
              )}
              Fuer alle Domains aktivieren
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Dies richtet info@[domain] Weiterleitung zu deiner Email ein. Dynadot setzt automatisch die MX-Records.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
