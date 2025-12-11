import { NextResponse } from 'next/server';
import { listDomains } from '@/lib/dynadot';

export async function GET() {
  try {
    const domains = await listDomains();
    return NextResponse.json(domains);
  } catch (error) {
    console.error('Failed to list domains:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
