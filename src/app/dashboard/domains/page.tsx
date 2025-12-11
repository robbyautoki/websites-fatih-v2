"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2Icon, SaveIcon, RefreshCwIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  fetchDomains,
  fetchImportedDomains,
  setEmailForward,
  setUrlForwarding,
  updateImportedDomain,
  type DomainInfo,
  type ImportedDomain,
} from "@/lib/api";

interface DomainSettings {
  forwardUrl: string;
  emailPrefix: string;
  emailForwardTo: string;
  saving: boolean;
  message?: string;
}

export default function DomainsPage() {
  const [dynadotDomains, setDynadotDomains] = useState<DomainInfo[]>([]);
  const [importedDomains, setImportedDomains] = useState<ImportedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainSettings, setDomainSettings] = useState<Record<string, DomainSettings>>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dynadot, imported] = await Promise.all([
        fetchDomains(),
        fetchImportedDomains()
      ]);
      setDynadotDomains(dynadot);
      setImportedDomains(imported);

      // Initialize settings for Dynadot domains with data from ImportedDomain if available
      const settings: Record<string, DomainSettings> = {};
      dynadot.forEach(d => {
        // Check if this domain was purchased through our app
        const importedMatch = imported.find(i => i.purchasedDomain === d.domain);

        settings[d.domain] = {
          forwardUrl: importedMatch?.forwardUrl || '',
          emailPrefix: importedMatch?.emailPrefix || '',
          emailForwardTo: importedMatch?.emailForwardTo || '',
          saving: false
        };
      });
      setDomainSettings(settings);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateSettings = (domain: string, update: Partial<DomainSettings>) => {
    setDomainSettings(prev => ({
      ...prev,
      [domain]: { ...prev[domain], ...update }
    }));
  };

  const handleSaveDynadot = async (domain: string) => {
    const settings = domainSettings[domain];
    if (!settings) return;

    updateSettings(domain, { saving: true, message: undefined });

    try {
      // Set URL forwarding if provided
      if (settings.forwardUrl) {
        const urlResult = await setUrlForwarding(domain, settings.forwardUrl, true);
        if (!urlResult.success) {
          throw new Error(urlResult.message);
        }
      }

      // Set email forwarding if both fields are provided
      if (settings.emailPrefix && settings.emailForwardTo) {
        const emailResult = await setEmailForward(domain, [
          { username: settings.emailPrefix, forwardTo: settings.emailForwardTo }
        ]);
        if (!emailResult.success) {
          throw new Error(emailResult.message);
        }
      }

      updateSettings(domain, { saving: false, message: 'Gespeichert!' });
      setTimeout(() => updateSettings(domain, { message: undefined }), 3000);
    } catch (err) {
      updateSettings(domain, {
        saving: false,
        message: err instanceof Error ? err.message : 'Fehler'
      });
    }
  };

  const handleSaveImported = async (id: string) => {
    const domain = importedDomains.find(d => d.id === id);
    if (!domain?.purchasedDomain) return;

    setImportedDomains(prev =>
      prev.map(d => d.id === id ? { ...d, status: 'configuring_url' } : d)
    );

    try {
      // Set URL forwarding if provided
      if (domain.forwardUrl) {
        const urlResult = await setUrlForwarding(domain.purchasedDomain, domain.forwardUrl, true);
        if (!urlResult.success) {
          throw new Error(urlResult.message);
        }
      }

      // Set email forwarding if both fields are provided
      if (domain.emailPrefix && domain.emailForwardTo) {
        const emailResult = await setEmailForward(domain.purchasedDomain, [
          { username: domain.emailPrefix, forwardTo: domain.emailForwardTo }
        ]);
        if (!emailResult.success) {
          throw new Error(emailResult.message);
        }
      }

      await updateImportedDomain(id, { status: 'done', error: null });
      setImportedDomains(prev =>
        prev.map(d => d.id === id ? { ...d, status: 'done', error: null } : d)
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Fehler';
      await updateImportedDomain(id, { status: 'error', error: errorMsg });
      setImportedDomains(prev =>
        prev.map(d => d.id === id ? { ...d, status: 'error', error: errorMsg } : d)
      );
    }
  };

  const handleImportedFieldChange = async (id: string, field: keyof ImportedDomain, value: string) => {
    // Update local state
    setImportedDomains(prev =>
      prev.map(d => d.id === id ? { ...d, [field]: value } : d)
    );

    // Save to database (debounced would be better in production)
    try {
      await updateImportedDomain(id, { [field]: value });
    } catch (err) {
      console.error('Failed to update domain:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "Wartend", variant: "outline" },
      searching: { label: "Suche...", variant: "secondary" },
      found: { label: "Gefunden", variant: "default" },
      purchasing: { label: "Kaufe...", variant: "secondary" },
      configuring_email: { label: "Email...", variant: "secondary" },
      configuring_url: { label: "URL...", variant: "secondary" },
      done: { label: "Fertig", variant: "default" },
      error: { label: "Fehler", variant: "destructive" },
      no_variant: { label: "Keine Variante", variant: "destructive" },
      active: { label: "Aktiv", variant: "default" },
    };
    const { label, variant } = variants[status] || { label: status, variant: "outline" as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Filter imported domains that have been purchased (status done or have purchasedDomain)
  const purchasedImportedDomains = importedDomains.filter(d =>
    d.purchasedDomain && ['done', 'error', 'configuring_email', 'configuring_url'].includes(d.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Meine Domains</h2>
          <p className="text-muted-foreground">
            Verwalte URL-Weiterleitungen und Email-Weiterleitungen.
          </p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Aktualisieren
        </Button>
      </div>

      <Tabs defaultValue="dynadot">
        <TabsList>
          <TabsTrigger value="dynadot">Dynadot ({dynadotDomains.length})</TabsTrigger>
          <TabsTrigger value="imported">Importiert ({purchasedImportedDomains.length})</TabsTrigger>
        </TabsList>

        {/* Dynadot Domains Tab */}
        <TabsContent value="dynadot">
          <Card>
            <CardHeader>
              <CardTitle>Dynadot Domains</CardTitle>
              <CardDescription>
                Domains direkt bei Dynadot registriert.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dynadotDomains.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Keine Domains gefunden
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ablauf</TableHead>
                      <TableHead>URL-Weiterleitung</TableHead>
                      <TableHead>Email-Weiterleitung</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dynadotDomains.map((domain) => (
                      <TableRow key={domain.domain}>
                        <TableCell className="font-medium">{domain.domain}</TableCell>
                        <TableCell>
                          {getStatusBadge(domain.status || 'active')}
                        </TableCell>
                        <TableCell>{domain.expiration || "-"}</TableCell>
                        <TableCell>
                          <Input
                            placeholder="https://ziel-url.de"
                            value={domainSettings[domain.domain]?.forwardUrl || ''}
                            onChange={(e) => updateSettings(domain.domain, { forwardUrl: e.target.value })}
                            className="w-40 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              placeholder="info"
                              value={domainSettings[domain.domain]?.emailPrefix || ''}
                              onChange={(e) => updateSettings(domain.domain, { emailPrefix: e.target.value })}
                              className="w-16 text-xs"
                            />
                            <span className="text-muted-foreground">@{domain.domain} &rarr;</span>
                            <Input
                              placeholder="ziel@email.de"
                              value={domainSettings[domain.domain]?.emailForwardTo || ''}
                              onChange={(e) => updateSettings(domain.domain, { emailForwardTo: e.target.value })}
                              className="w-32 text-xs"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {domainSettings[domain.domain]?.message && (
                              <span className={`text-xs ${domainSettings[domain.domain]?.message?.includes('Fehler') ? 'text-destructive' : 'text-green-600'}`}>
                                {domainSettings[domain.domain]?.message}
                              </span>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleSaveDynadot(domain.domain)}
                              disabled={domainSettings[domain.domain]?.saving}
                            >
                              {domainSettings[domain.domain]?.saving ? (
                                <Loader2Icon className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <SaveIcon className="mr-1 h-3 w-3" />
                                  Speichern
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Imported Domains Tab */}
        <TabsContent value="imported">
          <Card>
            <CardHeader>
              <CardTitle>Importierte Domains</CardTitle>
              <CardDescription>
                Domains aus CSV-Import mit gekauften Varianten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {purchasedImportedDomains.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Keine importierten Domains mit gekauften Varianten
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Original</TableHead>
                      <TableHead>Gekaufte Variante</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>URL-Weiterleitung</TableHead>
                      <TableHead>Email-Weiterleitung</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchasedImportedDomains.map((domain) => (
                      <TableRow key={domain.id}>
                        <TableCell className="text-muted-foreground text-xs">{domain.originalDomain}</TableCell>
                        <TableCell className="font-medium">{domain.purchasedDomain}</TableCell>
                        <TableCell>
                          {getStatusBadge(domain.status)}
                          {domain.error && (
                            <span className="ml-2 text-xs text-destructive">{domain.error}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder={`https://${domain.originalDomain}`}
                            value={domain.forwardUrl || ''}
                            onChange={(e) => handleImportedFieldChange(domain.id, 'forwardUrl', e.target.value)}
                            className="w-40 text-xs"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              placeholder="info"
                              value={domain.emailPrefix || ''}
                              onChange={(e) => handleImportedFieldChange(domain.id, 'emailPrefix', e.target.value)}
                              className="w-16 text-xs"
                            />
                            <span className="text-muted-foreground text-xs">@{domain.purchasedDomain} &rarr;</span>
                            <Input
                              placeholder="ziel@email.de"
                              value={domain.emailForwardTo || ''}
                              onChange={(e) => handleImportedFieldChange(domain.id, 'emailForwardTo', e.target.value)}
                              className="w-28 text-xs"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => handleSaveImported(domain.id)}
                            disabled={['configuring_email', 'configuring_url'].includes(domain.status)}
                          >
                            {['configuring_email', 'configuring_url'].includes(domain.status) ? (
                              <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <SaveIcon className="mr-1 h-3 w-3" />
                                Speichern
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
