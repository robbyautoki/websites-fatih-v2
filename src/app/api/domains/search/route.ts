import { NextRequest, NextResponse } from 'next/server';
import { searchDomain } from '@/lib/dynadot';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');

  if (!domain) {
    return NextResponse.json({ error: 'Domain parameter required' }, { status: 400 });
  }

  try {
    const result = await searchDomain(domain);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Domain search failed:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
