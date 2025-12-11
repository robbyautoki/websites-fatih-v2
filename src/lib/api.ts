const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// ============================================
// Websites API
// ============================================

export interface Website {
  adresse: string;
  firmenname: string;
  inhaber: string;
  domain: string;
  claim: string;
  seitensprache: string;
  status: 'not_deployed' | 'deploying' | 'online' | 'error';
  dropletId?: number;
  dropletIp?: string;
}

export async function fetchWebsites(): Promise<Website[]> {
  const response = await fetch(`${API_BASE}/websites`);
  if (!response.ok) {
    throw new Error('Failed to fetch websites');
  }
  return response.json();
}

export async function deployWebsite(domain: string): Promise<void> {
  const response = await fetch(`${API_BASE}/websites/${domain}/deploy`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to deploy');
  }
}

export async function deleteWebsite(domain: string): Promise<void> {
  const response = await fetch(`${API_BASE}/websites/${domain}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete');
  }
}

export async function setupSSL(domain: string): Promise<void> {
  const response = await fetch(`${API_BASE}/websites/${domain}/ssl`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Failed to setup SSL');
  }
}

// ============================================
// Domain API (Dynadot)
// ============================================

export interface DomainSearchResult {
  domain: string;
  available: boolean;
  price?: number;
  currency?: string;
}

export interface DomainInfo {
  domain: string;
  expiration?: string;
  status?: string;
}

export interface DnsRecord {
  type: string;
  value: string;
  priority?: number;
}

export async function searchDomain(domain: string): Promise<DomainSearchResult> {
  const response = await fetch(`${API_BASE}/domains/search?domain=${encodeURIComponent(domain)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search domain');
  }
  return response.json();
}

export async function registerDomain(domain: string, duration: number = 1): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/domains/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, duration }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to register domain');
  }
  return response.json();
}

export async function fetchDomains(): Promise<DomainInfo[]> {
  const response = await fetch(`${API_BASE}/domains`);
  if (!response.ok) {
    throw new Error('Failed to fetch domains');
  }
  return response.json();
}

export async function getDnsRecords(domain: string): Promise<DnsRecord[]> {
  const response = await fetch(`${API_BASE}/domains/${encodeURIComponent(domain)}/dns`);
  if (!response.ok) {
    throw new Error('Failed to get DNS records');
  }
  return response.json();
}

export async function setDnsRecords(domain: string, records: DnsRecord[]): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/domains/${encodeURIComponent(domain)}/dns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set DNS records');
  }
  return response.json();
}

export async function setARecord(domain: string, ip: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/domains/${encodeURIComponent(domain)}/dns/a`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set A record');
  }
  return response.json();
}

export async function setEmailForward(
  domain: string,
  forwards: { username: string; forwardTo: string }[]
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/domains/${encodeURIComponent(domain)}/email-forward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forwards }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set email forwarding');
  }
  return response.json();
}

export interface EmailForwardAllResult {
  success: boolean;
  message: string;
  results: { domain: string; success: boolean; message: string }[];
}

export async function setupEmailForwardAll(forwardTo: string): Promise<EmailForwardAllResult> {
  const response = await fetch(`${API_BASE}/domains/email-forward-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forwardTo }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set email forwarding for all domains');
  }
  return response.json();
}

export async function setUrlForwarding(
  domain: string,
  forwardUrl: string,
  isPermanent: boolean = true
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/domains/${encodeURIComponent(domain)}/forward-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forwardUrl, isPermanent }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to set URL forwarding');
  }
  return response.json();
}

// ============================================
// Email API (Mailcow)
// ============================================

export interface MailConnectionInfo {
  webmail: string;
  imap: { host: string; port: number; security: string };
  smtp: { host: string; port: number; security: string };
  pop3: { host: string; port: number; security: string };
}

export interface EmailStatus {
  configured: boolean;
  connectionInfo: MailConnectionInfo | null;
}

export interface Mailbox {
  username: string;
  name: string;
  domain: string;
  quota: number;
  active: number;
}

export async function getEmailStatus(): Promise<EmailStatus> {
  const response = await fetch(`${API_BASE}/emails/status`);
  if (!response.ok) {
    return { configured: false, connectionInfo: null };
  }
  return response.json();
}

export async function createMailbox(
  email: string,
  password: string,
  name?: string
): Promise<{ success: boolean; message: string; email?: string; connectionInfo?: MailConnectionInfo }> {
  const response = await fetch(`${API_BASE}/emails/mailbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create mailbox');
  }
  return response.json();
}

export async function getMailboxes(domain?: string): Promise<Mailbox[]> {
  const url = domain
    ? `${API_BASE}/emails/mailboxes/${encodeURIComponent(domain)}`
    : `${API_BASE}/emails/mailboxes`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to get mailboxes');
  }
  return response.json();
}

export async function deleteMailbox(email: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/emails/mailbox/${encodeURIComponent(email)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete mailbox');
  }
  return response.json();
}

export async function setupEmailDns(domain: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/emails/dns/${encodeURIComponent(domain)}/setup`, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to setup email DNS');
  }
  return response.json();
}
