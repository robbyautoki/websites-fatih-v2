"use client";

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from "react";
import {
  SearchIcon,
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  TrashIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  fetchDomains,
  searchDomain,
  registerDomain,
  setEmailForward,
  setUrlForwarding,
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
  emailPrefix: string;
  domains: ImportedDomain[];
}

const CSV_STORAGE_KEY = "domain-csv-import-v2";
const EMAIL_PREFIXES = ['info', 'support', 'sekretariat', 'it', 'kontakt', 'verwaltung', 'buero'];

// CSV Parser der Quotes und Kommas korrekt behandelt
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Organization Name zu Domain konvertieren
function orgNameToDomain(orgName: string): string {
  return orgName
    .toLowerCase()
    .replace(/[^a-z0-9äöüß-]/g, '')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    + '.de';
}

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

export default function CsvImportPage() {
  const [csvImportSettings, setCsvImportSettings] = useState<CsvImportSettings>({
    emailForwardTo: "",
    emailPrefix: "info",
    domains: [],
  });
  const [csvProcessingDomain, setCsvProcessingDomain] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    loadCsvSettings();
  }, [loadCsvSettings]);

  const handleCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);

      // Skip header line
      const dataLines = lines.slice(1);

      const newDomains: ImportedDomain[] = dataLines
        .map(line => {
          const columns = parseCSVLine(line);
          const orgName = columns[0]?.replace(/"/g, ''); // Erste Spalte = organization name
          if (!orgName) return null;

          const domain = orgNameToDomain(orgName);
          return domain;
        })
        .filter((domain): domain is string =>
          domain !== null &&
          domain.length > 3 &&
          !csvImportSettings.domains.some(d => d.originalDomain === domain)
        )
        .map(domain => ({
          originalDomain: domain,
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
      updateCsvDomain(originalDomain, { status: 'purchasing' });
      const purchaseResult = await registerDomain(domain.suggestedVariant);
      if (!purchaseResult.success) {
        throw new Error(purchaseResult.message);
      }

      updateCsvDomain(originalDomain, { status: 'configuring_email' });
      const emailResult = await setEmailForward(domain.suggestedVariant, [
        { username: csvImportSettings.emailPrefix || 'info', forwardTo: csvImportSettings.emailForwardTo }
      ]);
      if (!emailResult.success) {
        throw new Error(emailResult.message);
      }

      updateCsvDomain(originalDomain, { status: 'configuring_url' });
      const urlResult = await setUrlForwarding(domain.suggestedVariant, `https://${originalDomain}`, true);
      if (!urlResult.success) {
        throw new Error(urlResult.message);
      }

      updateCsvDomain(originalDomain, { status: 'done' });
      fetchDomains();
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
        { username: csvImportSettings.emailPrefix || 'info', forwardTo: csvImportSettings.emailForwardTo }
      ]);
      if (!emailResult.success) {
        throw new Error(emailResult.message);
      }

      updateCsvDomain(originalDomain, { status: 'configuring_url' });
      const urlResult = await setUrlForwarding(domain.suggestedVariant, `https://${originalDomain}`, true);
      if (!urlResult.success) {
        throw new Error(urlResult.message);
      }

      updateCsvDomain(originalDomain, { status: 'done' });
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">CSV Import</h2>
        <p className="text-muted-foreground">
          Lade eine CSV mit Haupt-Domains hoch. Das System sucht verfuegbare Varianten und kauft diese automatisch.
        </p>
      </div>

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
            <div className="space-y-2">
              <Label htmlFor="email-prefix">Email Präfix</Label>
              <Select
                value={csvImportSettings.emailPrefix || 'info'}
                onValueChange={(value) => saveCsvSettings({ ...csvImportSettings, emailPrefix: value })}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Präfix wählen" />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_PREFIXES.map(prefix => (
                    <SelectItem key={prefix} value={prefix}>
                      {prefix}@
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="email-forward">Weiterleitung an</Label>
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
    </div>
  );
}
