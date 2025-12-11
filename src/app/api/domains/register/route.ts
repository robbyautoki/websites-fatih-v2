import { NextRequest, NextResponse } from 'next/server';
import { registerDomain } from '@/lib/dynadot';

export async function POST(request: NextRequest) {
  try {
    const { domain, duration = 1 } = await request.json();

    if (!domain) {
      return NextResponse.json({ error: 'Domain required' }, { status: 400 });
    }

    const result = await registerDomain(domain, duration);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Domain registration failed:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
