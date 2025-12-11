import { XMLParser } from 'fast-xml-parser';

const DYNADOT_BASE_URL = 'https://api.dynadot.com/api3.xml';

function getApiKey(): string {
  const key = process.env.DYNADOT_API_KEY;
  if (!key) {
    throw new Error('DYNADOT_API_KEY not configured');
  }
  return key;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_'
});

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function dynadotRequest(command: string, params: Record<string, string> = {}): Promise<any> {
  const urlParams = new URLSearchParams({
    key: getApiKey(),
    command,
    ...params
  });

  const url = `${DYNADOT_BASE_URL}?${urlParams.toString()}`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    const result = parser.parse(text);

    // Log response for debugging
    console.log(`Dynadot API [${command}] response:`, JSON.stringify(result, null, 2));

    // Check for API errors - handle multiple response formats
    const errorMsg = result.Results?.Error
      || result.SearchResponse?.Error
      || result.Response?.ResponseHeader?.Error
      || result.ListDomainInfoResponse?.ResponseHeader?.Error;

    const errorCode = result.Response?.ResponseHeader?.ResponseCode
      || result.ListDomainInfoResponse?.ResponseHeader?.ResponseCode;

    if (errorMsg || errorCode === '-1' || errorCode === -1) {
      throw new Error(errorMsg || 'Dynadot API error');
    }

    return result;
  } catch (error) {
    console.error('Dynadot API request failed:', error);
    throw error;
  }
}

// Search for domain availability
export async function searchDomain(domain: string): Promise<DomainSearchResult> {
  const result = await dynadotRequest('search', { domain0: domain });

  // Handle both response formats
  const searchResult = result.Results?.SearchResponse?.SearchHeader
    || result.SearchResponse?.SearchResults?.SearchResult
    || result.SearchResponse?.SearchHeader;

  if (!searchResult) {
    console.error('Dynadot response:', JSON.stringify(result, null, 2));
    throw new Error('Invalid response from Dynadot');
  }

  return {
    domain: searchResult.DomainName || domain,
    available: searchResult.Available === 'yes',
    price: searchResult.Price ? parseFloat(searchResult.Price) : undefined,
    currency: searchResult.Currency || 'USD'
  };
}

// Register a domain
export async function registerDomain(domain: string, duration: number = 1): Promise<{ success: boolean; message: string }> {
  try {
    await dynadotRequest('register', {
      domain,
      duration: duration.toString()
    });

    return {
      success: true,
      message: `Domain ${domain} successfully registered for ${duration} year(s)`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Registration failed'
    };
  }
}

// List all domains in account
export async function listDomains(): Promise<DomainInfo[]> {
  const result = await dynadotRequest('list_domain');

  // Log the full response structure for debugging
  console.log('Full list_domain response structure:', JSON.stringify(result, null, 2));

  // Handle response format - try multiple paths
  const domains = result.ListDomainInfoResponse?.ListDomainInfoContent?.DomainInfoList?.DomainInfo
    || result.ListDomainInfoResponse?.DomainInfoList?.DomainInfo
    || result.ListDomainInfoResponse?.ListDomainInfoContent?.DomainInfo
    || result.ListDomainInfoResponse?.DomainInfo;

  if (!domains) {
    console.log('No domains found in response. Available keys:', Object.keys(result.ListDomainInfoResponse || {}));
    return [];
  }

  const domainList = Array.isArray(domains) ? domains : [domains];
  console.log(`Found ${domainList.length} domains`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return domainList.map((d: any) => {
    // Log raw domain object to understand structure
    console.log('Raw domain object:', JSON.stringify(d, null, 2));

    // Try multiple possible paths for domain name
    const domainName = d.Name || d.Domain?.Name || d.DomainName || d.domain || '';

    // Try multiple paths for expiration
    const rawExpiration = d.Expiration || d.Domain?.Expiration || d.ExpirationDate || '';
    let expiration: string | undefined;
    if (rawExpiration) {
      try {
        // Handle Unix timestamp (milliseconds)
        const timestamp = parseInt(rawExpiration);
        if (!isNaN(timestamp)) {
          expiration = new Date(timestamp).toISOString().split('T')[0];
        } else {
          expiration = new Date(rawExpiration).toISOString().split('T')[0];
        }
      } catch {
        expiration = rawExpiration;
      }
    }

    // Try multiple paths for status
    const status = d.Status || d.Domain?.Status || d.RegistrationStatus || 'active';

    console.log('Parsed domain:', { domainName, expiration, status });

    return {
      domain: domainName,
      expiration,
      status
    };
  });
}

// Set email forwarding (Dynadot built-in feature)
export async function setEmailForward(
  domain: string,
  forwards: { username: string; forwardTo: string }[]
): Promise<{ success: boolean; message: string }> {
  const params: Record<string, string> = {
    domain,
    forward_type: 'forward'
  };

  forwards.forEach((fwd, i) => {
    params[`username${i}`] = fwd.username;
    params[`exist_email${i}`] = fwd.forwardTo;
  });

  try {
    await dynadotRequest('set_email_forward', params);
    return {
      success: true,
      message: 'Email forwarding configured successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to set email forwarding'
    };
  }
}

// Set URL forwarding (domain redirect)
export async function setUrlForwarding(
  domain: string,
  forwardUrl: string,
  isPermanent: boolean = true
): Promise<{ success: boolean; message: string }> {
  // Ensure URL has protocol
  let normalizedUrl = forwardUrl;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const params: Record<string, string> = {
    domain,
    forward_url: normalizedUrl
  };

  // is_temp: default is temporary (302), 'no' means permanent (301)
  if (isPermanent) {
    params.is_temp = 'no';
  }

  try {
    await dynadotRequest('set_forwarding', params);
    return {
      success: true,
      message: `Domain ${domain} forwarding to ${normalizedUrl} configured successfully`
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to set URL forwarding'
    };
  }
}
