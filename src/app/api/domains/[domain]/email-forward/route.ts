import { NextRequest, NextResponse } from 'next/server';
import { setEmailForward } from '@/lib/dynadot';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const { forwards } = await request.json();

    if (!forwards || !Array.isArray(forwards)) {
      return NextResponse.json({ error: 'Forwards array required' }, { status: 400 });
    }

    const result = await setEmailForward(domain, forwards);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to set email forwarding:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
