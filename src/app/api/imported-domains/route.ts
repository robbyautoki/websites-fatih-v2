import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Alle importierten Domains laden
export async function GET() {
  try {
    const domains = await prisma.importedDomain.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(domains);
  } catch (error) {
    console.error('Failed to fetch imported domains:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// POST: Neue Domain(s) hinzufügen
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Single domain or array of domains
    if (Array.isArray(body)) {
      const domains = await prisma.importedDomain.createMany({
        data: body.map((d: { originalDomain: string; emailForwardTo?: string }) => ({
          originalDomain: d.originalDomain,
          emailForwardTo: d.emailForwardTo,
          status: 'pending'
        }))
      });
      return NextResponse.json({ success: true, count: domains.count });
    } else {
      const domain = await prisma.importedDomain.create({
        data: {
          originalDomain: body.originalDomain,
          emailForwardTo: body.emailForwardTo,
          status: 'pending'
        }
      });
      return NextResponse.json(domain);
    }
  } catch (error) {
    console.error('Failed to create imported domain:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE: Alle Domains löschen (für Reset)
export async function DELETE() {
  try {
    await prisma.importedDomain.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete all imported domains:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
