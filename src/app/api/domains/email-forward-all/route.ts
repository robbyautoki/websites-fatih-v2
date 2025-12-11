import { NextRequest, NextResponse } from 'next/server';
import { listDomains, setEmailForward } from '@/lib/dynadot';

export async function POST(request: NextRequest) {
  try {
    const { forwardTo } = await request.json();

    if (!forwardTo || typeof forwardTo !== 'string') {
      return NextResponse.json({ error: 'forwardTo email address required' }, { status: 400 });
    }

    // Get all domains
    const domains = await listDomains();

    if (domains.length === 0) {
      return NextResponse.json({ error: 'No domains found in account' }, { status: 400 });
    }

    const results: { domain: string; success: boolean; message: string }[] = [];

    // Set email forwarding for each domain
    for (const domainInfo of domains) {
      try {
        const result = await setEmailForward(domainInfo.domain, [
          { username: 'info', forwardTo }
        ]);
        results.push({
          domain: domainInfo.domain,
          success: result.success,
          message: result.message
        });
      } catch (error) {
        results.push({
          domain: domainInfo.domain,
          success: false,
          message: error instanceof Error ? error.message : 'Failed'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return NextResponse.json({
      success: successCount > 0,
      message: `Email forwarding set for ${successCount}/${domains.length} domains`,
      results
    });
  } catch (error) {
    console.error('Failed to set email forwarding for all domains:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
