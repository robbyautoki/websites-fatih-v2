import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: Einzelne Domain laden
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const domain = await prisma.importedDomain.findUnique({
      where: { id }
    });

    if (!domain) {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }

    return NextResponse.json(domain);
  } catch (error) {
    console.error('Failed to fetch imported domain:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// PATCH: Domain aktualisieren
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const domain = await prisma.importedDomain.update({
      where: { id },
      data: {
        ...(body.purchasedDomain !== undefined && { purchasedDomain: body.purchasedDomain }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.forwardUrl !== undefined && { forwardUrl: body.forwardUrl }),
        ...(body.emailPrefix !== undefined && { emailPrefix: body.emailPrefix }),
        ...(body.emailForwardTo !== undefined && { emailForwardTo: body.emailForwardTo }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.error !== undefined && { error: body.error }),
      }
    });

    return NextResponse.json(domain);
  } catch (error) {
    console.error('Failed to update imported domain:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// DELETE: Domain löschen
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.importedDomain.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete imported domain:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
