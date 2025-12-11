"use client";

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import { UserButton } from "@clerk/nextjs";
import {
  GlobeIcon,
  MailIcon,
  UploadIcon,
  SearchIcon,
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  TrashIcon,
  Loader2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import {
  fetchDomains,
  searchDomain,
  registerDomain,
  setEmailForward,
  setUrlForwarding,
  setupEmailForwardAll,
  type DomainInfo,
} from "@/lib/api";

// Types
interface ImportedDomain {
  originalDomain: string;
  suggestedVariant?: string;
  variantPrice?: number;
  status: 'pending' | 'searching' | 'found' | 'approving' | 'purchasing' | 'configuring_email' | 'configuring_url' | 'done' | 'error' | 'no_variant';
  error?: string;
  addedAt: string;
}

interface CsvImportSettings {
  emailForwardTo: string;
  domains: ImportedDomain[];
}

const CSV_STORAGE_KEY = "domain-csv-import-v2";

// Domain variant generator
function generateDomainVariants(domain: string): string[] {
  const parts = domain.split('.');
  if (parts.length < 2) return [];

  const name = parts[0];
  const tld = parts.slice(1).join('.');
  const variants: string[] = [];

  // Hyphens at different positions
  for (let i = 1; i < name.length; i++) {
    const variant = name.slice(0, i) + '-' + name.slice(i);
    variants.push(`${variant}.${tld}`);
  }

  // Prefixes
  const prefixes = ['das-', 'der-', 'die-', 'mein-'];
  for (const prefix of prefixes) {
    variants.push(`${prefix}${name}.${tld}`);
  }

  return variants;
}

export default function DashboardPage() {
  // State
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvImportSettings, setCsvImportSettings] = useState<CsvImportSettings>({
    emailForwardTo: "",
    domains: [],
  });
  const [csvProcessingDomain, setCsvProcessingDomain] = useState<string | null>(null);
  const [bulkEmailTarget, setBulkEmailTarget] = useState("");
  const [bulkEmailLoading, setBulkEmailLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load data
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

  const loadCsvSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem(CSV_STORAGE_KEY);
      if (saved) {
        setCsvImportSettings(JSON.parse(saved));
      }
    } catch (err) {
      console.error("Failed to load CSV settings:", err);
    }
  }, []);

  const saveCsvSettings = useCallback((settings: CsvImportSettings) => {
    localStorage.setItem(CSV_STORAGE_KEY, JSON.stringify(settings));
    setCsvImportSettings(settings);
  }, []);

  const updateCsvDomain = useCallback((originalDomain: string, update: Partial<ImportedDomain>) => {
    setCsvImportSettings(prev => {
      const updated = {
        ...prev,
        domains: prev.domains.map(d =>
          d.originalDomain === originalDomain ? { ...d, ...update } : d
        ),
      };
      localStorage.setItem(CSV_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    loadDomains();
    loadCsvSettings();
  }, [loadDomains, loadCsvSettings]);

  // CSV Import handlers
  const handleCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);

      const newDomains: ImportedDomain[] = lines
        .filter(line => !csvImportSettings.domains.some(d => d.originalDomain === line))
        .map(line => ({
          originalDomain: line.toLowerCase(),
          status: 'pending' as const,
          addedAt: new Date().toISOString(),
        }));

      if (newDomains.length > 0) {
        saveCsvSettings({
          ...csvImportSettings,
          domains: [...csvImportSettings.domains, ...newDomains],
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSearchVariants = async () => {
    const pendingDomains = csvImportSettings.domains.filter(d => d.status === 'pending');

    for (const domain of pendingDomains) {
      setCsvProcessingDomain(domain.originalDomain);
      updateCsvDomain(domain.originalDomain, { status: 'searching' });

      const variants = generateDomainVariants(domain.originalDomain);
      let found = false;

      for (const variant of variants) {
        try {
          const result = await searchDomain(variant);
          if (result.available) {
            updateCsvDomain(domain.originalDomain, {
              status: 'found',
              suggestedVariant: variant,
              variantPrice: result.price,
            });
            found = true;
            break;
          }
        } catch (err) {
          console.error(`Error checking ${variant}:`, err);
        }
      }

      if (!found) {
        updateCsvDomain(domain.originalDomain, { status: 'no_variant' });
      }
    }
    setCsvProcessingDomain(null);
  };

  const handleApprove = async (originalDomain: string) => {
    const domain = csvImportSettings.domains.find(d => d.originalDomain === originalDomain);
    if (!domain?.suggestedVariant || !csvImportSettings.emailForwardTo) return;

    setCsvProcessingDomain(originalDomain);

    try {
      // Purchase domain
      updateCsvDomain(originalDomain, { status: 'purchasing' });
      const purchaseResult = await registerDomain(domain.suggestedVariant);
      if (!purchaseResult.success) {
        throw new Error(purchaseResult.message);
      }

      // Set email forwarding
      updateCsvDomain(originalDomain, { status: 'configuring_email' });
      const emailResult = await setEmailForward(domain.suggestedVariant, [
        { username: 'info', forwardTo: csvImportSettings.emailForwardTo }
      ]);
      if (!emailResult.success) {
        throw new Error(emailResult.message);
      }

      // Set URL forwarding
      updateCsvDomain(originalDomain, { status: 'configuring_url' });
      const urlResult = await setUrlForwarding(domain.suggestedVariant, originalDomain, true);
      if (!urlResult.success) {
        throw new Error(urlResult.message);
      }

      updateCsvDomain(originalDomain, { status: 'done' });
      loadDomains();
    } catch (err) {
      updateCsvDomain(originalDomain, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    } finally {
      setCsvProcessingDomain(null);
    }
  };

  const handleRetryConfiguration = async (originalDomain: string) => {
    const domain = csvImportSettings.domains.find(d => d.originalDomain === originalDomain);
    if (!domain?.suggestedVariant || !csvImportSettings.emailForwardTo) return;

    setCsvProcessingDomain(originalDomain);

    try {
      updateCsvDomain(originalDomain, { status: 'configuring_email', error: undefined });
      const emailResult = await setEmailForward(domain.suggestedVariant, [
        { username: 'info', forwardTo: csvImportSettings.emailForwardTo }
      ]);
      if (!emailResult.success) {
        throw new Error(emailResult.message);
      }

      updateCsvDomain(originalDomain, { status: 'configuring_url' });
      const urlResult = await setUrlForwarding(domain.suggestedVariant, originalDomain, true);
      if (!urlResult.success) {
        throw new Error(urlResult.message);
      }

      updateCsvDomain(originalDomain, { status: 'done' });
      loadDomains();
    } catch (err) {
      updateCsvDomain(originalDomain, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    } finally {
      setCsvProcessingDomain(null);
    }
  };

  const handleRemoveCsvDomain = (originalDomain: string) => {
    saveCsvSettings({
      ...csvImportSettings,
      domains: csvImportSettings.domains.filter(d => d.originalDomain !== originalDomain),
    });
  };

  const handleClearCsvList = () => {
    saveCsvSettings({ ...csvImportSettings, domains: [] });
  };

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

  const getStatusBadge = (status: ImportedDomain['status']) => {
    const variants: Record<ImportedDomain['status'], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Wartend", variant: "outline" },
      searching: { label: "Suche...", variant: "secondary" },
      found: { label: "Gefunden", variant: "default" },
      approving: { label: "Genehmige...", variant: "secondary" },
      purchasing: { label: "Kaufe...", variant: "secondary" },
      configuring_email: { label: "Email...", variant: "secondary" },
      configuring_url: { label: "URL...", variant: "secondary" },
      done: { label: "Fertig", variant: "default" },
      error: { label: "Fehler", variant: "destructive" },
      no_variant: { label: "Keine Variante", variant: "destructive" },
    };
    const { label, variant } = variants[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  const pendingCount = csvImportSettings.domains.filter(d => d.status === 'pending').length;
  const foundCount = csvImportSettings.domains.filter(d => d.status === 'found').length;
  const doneCount = csvImportSettings.domains.filter(d => d.status === 'done').length;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <GlobeIcon className="h-6 w-6" />
            <h1 className="text-lg font-semibold">Domain Manager</h1>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">
        <Tabs defaultValue="csv-import" className="space-y-6">
          <TabsList>
            <TabsTrigger value="csv-import" className="gap-2">
              <UploadIcon className="h-4 w-4" />
              CSV Import
            </TabsTrigger>
            <TabsTrigger value="domains" className="gap-2">
              <GlobeIcon className="h-4 w-4" />
              Meine Domains
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <MailIcon className="h-4 w-4" />
              Email Weiterleitung
            </TabsTrigger>
          </TabsList>

          {/* CSV Import Tab */}
          <TabsContent value="csv-import" className="space-y-6">
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total</CardDescription>
                  <CardTitle className="text-2xl">{csvImportSettings.domains.length}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Wartend</CardDescription>
                  <CardTitle className="text-2xl">{pendingCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Gefunden</CardDescription>
                  <CardTitle className="text-2xl">{foundCount}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Fertig</CardDescription>
                  <CardTitle className="text-2xl">{doneCount}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {/* Upload & Settings */}
            <Card>
              <CardHeader>
                <CardTitle>CSV Import - Domain Varianten</CardTitle>
                <CardDescription>
                  Lade eine CSV mit Haupt-Domains hoch. Das System sucht verfuegbare Varianten und kauft diese automatisch.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="email-forward">Email-Weiterleitung Ziel</Label>
                    <Input
                      id="email-forward"
                      type="email"
                      placeholder="deine@email.de"
                      value={csvImportSettings.emailForwardTo}
                      onChange={(e) => saveCsvSettings({ ...csvImportSettings, emailForwardTo: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <UploadIcon className="mr-2 h-4 w-4" />
                      CSV hochladen
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={handleCsvUpload}
                    />
                    {pendingCount > 0 && (
                      <Button onClick={handleSearchVariants} disabled={!!csvProcessingDomain}>
                        <SearchIcon className="mr-2 h-4 w-4" />
                        Varianten suchen
                      </Button>
                    )}
                    {csvImportSettings.domains.length > 0 && (
                      <Button variant="destructive" size="icon" onClick={handleClearCsvList}>
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Domain Table */}
            {csvImportSettings.domains.length > 0 && (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Original Domain</TableHead>
                        <TableHead>Variante</TableHead>
                        <TableHead>Preis</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvImportSettings.domains.map((d) => (
                        <TableRow key={d.originalDomain}>
                          <TableCell className="font-medium">{d.originalDomain}</TableCell>
                          <TableCell>{d.suggestedVariant || "-"}</TableCell>
                          <TableCell>{d.variantPrice ? `${d.variantPrice}€` : "-"}</TableCell>
                          <TableCell>
                            {getStatusBadge(d.status)}
                            {d.error && (
                              <span className="ml-2 text-xs text-destructive">{d.error}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {d.status === 'found' && (
                              <Button
                                size="sm"
                                onClick={() => handleApprove(d.originalDomain)}
                                disabled={!!csvProcessingDomain || !csvImportSettings.emailForwardTo}
                              >
                                <CheckIcon className="mr-1 h-3 w-3" />
                                Kaufen
                              </Button>
                            )}
                            {(d.status === 'error' || d.status === 'done') && d.suggestedVariant && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetryConfiguration(d.originalDomain)}
                                disabled={!!csvProcessingDomain || !csvImportSettings.emailForwardTo}
                              >
                                <RefreshCwIcon className="mr-1 h-3 w-3" />
                                Retry
                              </Button>
                            )}
                            {['approving', 'purchasing', 'configuring_email', 'configuring_url', 'searching'].includes(d.status) && (
                              <Loader2Icon className="h-4 w-4 animate-spin inline" />
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveCsvDomain(d.originalDomain)}
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Domains Tab */}
          <TabsContent value="domains" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Meine Domains ({domains.length})</CardTitle>
                <CardDescription>
                  Alle bei Dynadot registrierten Domains
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2Icon className="h-6 w-6 animate-spin" />
                  </div>
                ) : domains.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Keine Domains gefunden
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domain</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ablaufdatum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {domains.map((domain) => (
                        <TableRow key={domain.domain}>
                          <TableCell className="font-medium">{domain.domain}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{domain.status || "aktiv"}</Badge>
                          </TableCell>
                          <TableCell>{domain.expiration || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Email-Weiterleitung fuer alle Domains</CardTitle>
                <CardDescription>
                  Richte info@ Weiterleitung fuer alle deine Domains ein
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
