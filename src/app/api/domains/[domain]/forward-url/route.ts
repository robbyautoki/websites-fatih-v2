import { NextRequest, NextResponse } from 'next/server';
import { setUrlForwarding } from '@/lib/dynadot';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const { forwardUrl, isPermanent = true } = await request.json();

    if (!forwardUrl) {
      return NextResponse.json({ error: 'forwardUrl required' }, { status: 400 });
    }

    const result = await setUrlForwarding(domain, forwardUrl, isPermanent);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to set URL forwarding:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
