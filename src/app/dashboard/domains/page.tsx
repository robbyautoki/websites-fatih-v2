"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2Icon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { fetchDomains, type DomainInfo } from "@/lib/api";

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Meine Domains</h2>
        <p className="text-muted-foreground">
          Alle bei Dynadot registrierten Domains.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Domains ({domains.length})</CardTitle>
          <CardDescription>
            Liste aller registrierten Domains mit Status und Ablaufdatum.
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
    </div>
  );
}
