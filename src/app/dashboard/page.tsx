"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GlobeIcon,
  UploadIcon,
  MailIcon,
  ArrowRightIcon,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { fetchDomains, type DomainInfo } from "@/lib/api";

const CSV_STORAGE_KEY = "domain-csv-import-v2";

export default function DashboardPage() {
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvStats, setCsvStats] = useState({ total: 0, pending: 0, found: 0, done: 0 });

  const loadDomains = useCallback(async () => {
    try {
      const data = await fetchDomains();
      setDomains(data);
    } catch (err) {
      console.error("Failed to load domains:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCsvStats = useCallback(() => {
    try {
      const saved = localStorage.getItem(CSV_STORAGE_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        const domains = settings.domains || [];
        setCsvStats({
          total: domains.length,
          pending: domains.filter((d: { status: string }) => d.status === 'pending').length,
          found: domains.filter((d: { status: string }) => d.status === 'found').length,
          done: domains.filter((d: { status: string }) => d.status === 'done').length,
        });
      }
    } catch (err) {
      console.error("Failed to load CSV stats:", err);
    }
  }, []);

  useEffect(() => {
    loadDomains();
    loadCsvStats();
  }, [loadDomains, loadCsvStats]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Willkommen im Domain Manager. Hier siehst du eine Uebersicht deiner Domains.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registrierte Domains</CardTitle>
            <GlobeIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? "..." : domains.length}</div>
            <p className="text-xs text-muted-foreground">Bei Dynadot registriert</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Datenbank</CardTitle>
            <UploadIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{csvStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {csvStats.pending} wartend, {csvStats.found} gefunden
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Varianten gefunden</CardTitle>
            <GlobeIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{csvStats.found}</div>
            <p className="text-xs text-muted-foreground">Warten auf Genehmigung</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fertig konfiguriert</CardTitle>
            <MailIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{csvStats.done}</div>
            <p className="text-xs text-muted-foreground">Mit Email & URL Forwarding</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UploadIcon className="h-5 w-5" />
              Datenbank
            </CardTitle>
            <CardDescription>
              Verwalte deine Domain-Datenbank und finde automatisch verfuegbare Varianten.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard/csv-import">
                Zur Datenbank
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GlobeIcon className="h-5 w-5" />
              Meine Domains
            </CardTitle>
            <CardDescription>
              Verwalte alle deine bei Dynadot registrierten Domains.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/domains">
                Domains anzeigen
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailIcon className="h-5 w-5" />
              Email Weiterleitung
            </CardTitle>
            <CardDescription>
              Richte info@ Weiterleitung fuer alle deine Domains ein.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/email">
                Email konfigurieren
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
