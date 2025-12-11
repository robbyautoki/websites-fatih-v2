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
  FileSpreadsheetIcon,
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
  searchDomain,
  registerDomain,
  setEmailForward,
  setUrlForwarding,
  fetchImportedDomains,
  createImportedDomains,
  updateImportedDomain,
  deleteImportedDomain,
  deleteAllImportedDomains,
  type ImportedDomain,
} from "@/lib/api";

const EMAIL_PREFIXES = [
  'sekretariat', 'verwaltung', 'info', 'kontakt',
  'poststelle', 'schulleitung', 'rektorat', 'rektor',
  'direktion', 'schulverwaltung', 'buero', 'schule'
];
const SETTINGS_KEY = 'csv-import-settings';

// Random email prefix - never same as last one
function getRandomEmailPrefix(lastPrefix: string): string {
  const availablePrefixes = EMAIL_PREFIXES.filter(p => p !== lastPrefix);
  const randomIndex = Math.floor(Math.random() * availablePrefixes.length);
  return availablePrefixes[randomIndex];
}

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
  const cleaned = orgName.trim().toLowerCase();

  // Wenn schon eine Domain mit TLD (enthält Punkt), direkt zurückgeben
  if (cleaned.includes('.')) {
    return cleaned;
  }

  // Sonst: Name zu Domain konvertieren
  return cleaned
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
  const [domains, setDomains] = useState<ImportedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [emailForwardTo, setEmailForwardTo] = useState('');
  const [lastEmailPrefix, setLastEmailPrefix] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Preview States
  const [csvData, setCsvData] = useState<string[][] | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<number>(0);
  const [importing, setImporting] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        setEmailForwardTo(settings.emailForwardTo || '');
        setLastEmailPrefix(settings.lastEmailPrefix || '');
      } catch {
        // ignore
      }
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = useCallback((email: string, prefix: string) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      emailForwardTo: email,
      lastEmailPrefix: prefix
    }));
  }, []);

  // Load domains from database
  const loadDomains = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchImportedDomains();
      setDomains(data);
    } catch (err) {
      console.error('Failed to load domains:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  // Update domain in database
  const updateDomain = async (id: string, data: Partial<ImportedDomain>) => {
    try {
      const updated = await updateImportedDomain(id, data);
      setDomains(prev => prev.map(d => d.id === id ? updated : d));
      return updated;
    } catch (err) {
      console.error('Failed to update domain:', err);
      throw err;
    }
  };

  const handleCsvUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);

      if (lines.length === 0) return;

      // Parse all lines
      const parsedLines = lines.map(line => parseCSVLine(line));

      // First line is headers
      const headers = parsedLines[0];
      const data = parsedLines.slice(1);

      setCsvHeaders(headers);
      setCsvData(data);
      setSelectedColumn(0);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancelCsvPreview = () => {
    setCsvData(null);
    setCsvHeaders([]);
    setSelectedColumn(0);
  };

  const handleImportCsv = async () => {
    if (!csvData) return;

    setImporting(true);
    const existingDomains = new Set(domains.map(d => d.originalDomain));

    // Prepare all domains in one batch
    const domainsToCreate: { originalDomain: string; emailForwardTo?: string }[] = [];

    for (const row of csvData) {
      const orgName = row[selectedColumn]?.replace(/"/g, '');
      if (!orgName) continue;

      const domain = orgNameToDomain(orgName);
      if (domain.length <= 3 || existingDomains.has(domain)) continue;

      domainsToCreate.push({
        originalDomain: domain,
        emailForwardTo: emailForwardTo || undefined
      });
      existingDomains.add(domain);
    }

    // Single batch API call
    if (domainsToCreate.length > 0) {
      try {
        await createImportedDomains(domainsToCreate);
        await loadDomains(); // Refresh all data
      } catch (err) {
        console.error('Failed to create domains:', err);
      }
    }

    setImporting(false);
    setCsvData(null);
    setCsvHeaders([]);
    setSelectedColumn(0);
  };

  // Search for variants for a single domain
  const handleSearchSingle = async (id: string) => {
    const domain = domains.find(d => d.id === id);
    if (!domain) return;

    setProcessingId(id);
    await updateDomain(id, { status: 'searching' });

    const variants = generateDomainVariants(domain.originalDomain);
    let found = false;

    for (const variant of variants) {
      try {
        const result = await searchDomain(variant);
        if (result.available) {
          await updateDomain(id, {
            status: 'found',
            purchasedDomain: variant,
            price: result.price,
          });
          found = true;
          break;
        }
      } catch (err) {
        console.error(`Error checking ${variant}:`, err);
      }
    }

    if (!found) {
      await updateDomain(id, { status: 'no_variant' });
    }
    setProcessingId(null);
  };

  // Search variants for ALL pending domains
  const handleSearchVariants = async () => {
    const pendingDomains = domains.filter(d => d.status === 'pending');

    for (const domain of pendingDomains) {
      await handleSearchSingle(domain.id);
    }
  };

  const handleApprove = async (id: string) => {
    const domain = domains.find(d => d.id === id);
    if (!domain?.purchasedDomain || !emailForwardTo) return;

    setProcessingId(id);

    try {
      await updateDomain(id, { status: 'purchasing' });
      const purchaseResult = await registerDomain(domain.purchasedDomain);
      if (!purchaseResult.success) {
        throw new Error(purchaseResult.message);
      }

      // Random email prefix - never same as last one
      const emailPrefix = getRandomEmailPrefix(lastEmailPrefix);
      setLastEmailPrefix(emailPrefix);
      saveSettings(emailForwardTo, emailPrefix);

      await updateDomain(id, { status: 'configuring_email', emailPrefix });
      const emailResult = await setEmailForward(domain.purchasedDomain, [
        { username: emailPrefix, forwardTo: emailForwardTo }
      ]);
      if (!emailResult.success) {
        throw new Error(emailResult.message);
      }

      // Use custom URL if provided, otherwise fallback to original domain
      const forwardUrl = domain.forwardUrl || `https://${domain.originalDomain}`;
      await updateDomain(id, { status: 'configuring_url', forwardUrl });
      const urlResult = await setUrlForwarding(domain.purchasedDomain, forwardUrl, true);
      if (!urlResult.success) {
        throw new Error(urlResult.message);
      }

      await updateDomain(id, { status: 'done' });
    } catch (err) {
      await updateDomain(id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRetryConfiguration = async (id: string) => {
    const domain = domains.find(d => d.id === id);
    if (!domain?.purchasedDomain || !emailForwardTo) return;

    setProcessingId(id);

    try {
      // Random email prefix - never same as last one
      const emailPrefix = getRandomEmailPrefix(lastEmailPrefix);
      setLastEmailPrefix(emailPrefix);
      saveSettings(emailForwardTo, emailPrefix);

      await updateDomain(id, { status: 'configuring_email', error: null, emailPrefix });
      const emailResult = await setEmailForward(domain.purchasedDomain, [
        { username: emailPrefix, forwardTo: emailForwardTo }
      ]);
      if (!emailResult.success) {
        throw new Error(emailResult.message);
      }

      // Use custom URL if provided, otherwise fallback to original domain
      const forwardUrl = domain.forwardUrl || `https://${domain.originalDomain}`;
      await updateDomain(id, { status: 'configuring_url', forwardUrl });
      const urlResult = await setUrlForwarding(domain.purchasedDomain, forwardUrl, true);
      if (!urlResult.success) {
        throw new Error(urlResult.message);
      }

      await updateDomain(id, { status: 'done' });
    } catch (err) {
      await updateDomain(id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Unbekannter Fehler',
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveDomain = async (id: string) => {
    try {
      await deleteImportedDomain(id);
      setDomains(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Failed to delete domain:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      await deleteAllImportedDomains();
      setDomains([]);
    } catch (err) {
      console.error('Failed to clear domains:', err);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmailForwardTo(value);
    saveSettings(value, lastEmailPrefix);
  };

  const handleForwardUrlChange = async (id: string, value: string) => {
    await updateDomain(id, { forwardUrl: value });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
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
    const { label, variant } = variants[status] || { label: status, variant: "outline" as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const pendingCount = domains.filter(d => d.status === 'pending').length;
  const foundCount = domains.filter(d => d.status === 'found').length;
  const doneCount = domains.filter(d => d.status === 'done').length;

  // Filter out purchased domains (status=done) from the table view
  const activeDomains = domains.filter(d => d.status !== 'done');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Datenbank</h2>
        <p className="text-muted-foreground">
          Verwalte deine Domain-Datenbank. Lade CSVs hoch und suche verfuegbare Varianten.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="text-2xl">{domains.length}</CardTitle>
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
          <CardTitle>CSV Import</CardTitle>
          <CardDescription>
            Lade eine CSV mit Haupt-Domains hoch. Das System sucht verfuegbare Varianten und kauft diese automatisch.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="email-forward">Email Weiterleitung an</Label>
              <Input
                id="email-forward"
                type="email"
                placeholder="deine@email.de"
                value={emailForwardTo}
                onChange={(e) => handleEmailChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Email Praefix wird automatisch zufaellig gewaehlt (info, support, sekretariat, etc.)
              </p>
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
                <Button onClick={handleSearchVariants} disabled={!!processingId}>
                  <SearchIcon className="mr-2 h-4 w-4" />
                  Varianten suchen
                </Button>
              )}
              {domains.length > 0 && (
                <Button variant="destructive" size="icon" onClick={handleClearAll}>
                  <TrashIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSV Preview & Column Selector */}
      {csvData && csvData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheetIcon className="h-5 w-5" />
              CSV Vorschau
            </CardTitle>
            <CardDescription>
              Waehle die Spalte aus, die die Domain-Namen enthaelt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Domain-Spalte</Label>
                <Select
                  value={String(selectedColumn)}
                  onValueChange={(v) => setSelectedColumn(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Spalte waehlen" />
                  </SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((header, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {header || `Spalte ${i + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancelCsvPreview}>
                  <XIcon className="mr-2 h-4 w-4" />
                  Abbrechen
                </Button>
                <Button onClick={handleImportCsv} disabled={importing}>
                  {importing ? (
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckIcon className="mr-2 h-4 w-4" />
                  )}
                  {csvData.length} Zeilen importieren
                </Button>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {csvHeaders.map((header, i) => (
                      <TableHead
                        key={i}
                        className={i === selectedColumn ? "bg-primary/10 font-bold" : ""}
                      >
                        {header || `Spalte ${i + 1}`}
                        {i === selectedColumn && (
                          <Badge variant="secondary" className="ml-2">Domain</Badge>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvData.slice(0, 5).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell
                          key={cellIndex}
                          className={cellIndex === selectedColumn ? "bg-primary/10 font-medium" : ""}
                        >
                          {cell || "-"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {csvData.length > 5 && (
              <p className="text-sm text-muted-foreground text-center">
                ... und {csvData.length - 5} weitere Zeilen
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Domain Table */}
      {activeDomains.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Original Domain</TableHead>
                  <TableHead>Variante</TableHead>
                  <TableHead>Preis</TableHead>
                  <TableHead>Forward URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeDomains.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.originalDomain}</TableCell>
                    <TableCell>{d.purchasedDomain || "-"}</TableCell>
                    <TableCell>{d.price ? `${d.price}€` : "-"}</TableCell>
                    <TableCell>
                      <Input
                        placeholder={`https://${d.originalDomain}`}
                        value={d.forwardUrl || ''}
                        onChange={(e) => handleForwardUrlChange(d.id, e.target.value)}
                        className="w-40 text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(d.status)}
                      {d.error && (
                        <span className="ml-2 text-xs text-destructive">{d.error}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {d.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSearchSingle(d.id)}
                          disabled={!!processingId}
                        >
                          <SearchIcon className="mr-1 h-3 w-3" />
                          Suchen
                        </Button>
                      )}
                      {d.status === 'found' && (
                        <Button
                          size="sm"
                          onClick={() => handleApprove(d.id)}
                          disabled={!!processingId || !emailForwardTo}
                        >
                          <CheckIcon className="mr-1 h-3 w-3" />
                          Kaufen
                        </Button>
                      )}
                      {(d.status === 'error' || d.status === 'done') && d.purchasedDomain && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetryConfiguration(d.id)}
                          disabled={!!processingId || !emailForwardTo}
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
                        onClick={() => handleRemoveDomain(d.id)}
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
