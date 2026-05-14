import { NextResponse } from 'next/server';
import { db } from '@/db';
import { creditPurchases, creditPackages, users } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';
import { generateInvoicePDF } from '@/lib/invoice/invoice.generator';
import { addDays } from 'date-fns';

/**
 * GET /api/admin/purchases/[id]/invoice
 * Streams the regenerated PDF invoice for a given credit purchase.
 * Admin-only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Fetch purchase + joined data needed to render the PDF
  const [row] = await db
    .select({
      id:             creditPurchases.id,
      invoiceNumber:  creditPurchases.invoiceNumber,
      invoiceIssuedAt: creditPurchases.invoiceIssuedAt,
      paymentDueDate: creditPurchases.paymentDueDate,
      priceCents:     creditPurchases.priceCents,
      currency:       creditPurchases.currency,
      creditsAmount:  creditPurchases.creditsAmount,
      creditType:     creditPurchases.creditType,
      paymentMethod:  creditPurchases.paymentMethod,
      packageName:    creditPackages.name,
      customerName:   users.name,
      customerEmail:  users.email,
    })
    .from(creditPurchases)
    .leftJoin(creditPackages, eq(creditPurchases.packageId, creditPackages.id))
    .leftJoin(users, and(eq(creditPurchases.userId, users.id), isNull(users.deletedAt)))
    .where(eq(creditPurchases.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
  }

  if (!row.invoiceNumber) {
    return NextResponse.json(
      { error: 'No invoice number on record — this purchase pre-dates the invoicing system.' },
      { status: 422 },
    );
  }

  const invoiceDate = row.invoiceIssuedAt ?? new Date();
  const dueDate     = row.paymentDueDate  ?? addDays(invoiceDate, 14);

  const pdfBuffer = await generateInvoicePDF({
    invoiceNumber:   row.invoiceNumber,
    invoiceDate,
    dueDate,
    customerName:    row.customerName  ?? 'Customer',
    customerEmail:   row.customerEmail ?? '',
    customerAddress: null,
    packageName:     row.packageName   ?? 'Credit Package',
    creditsAmount:   row.creditsAmount,
    creditType:      row.creditType,
    priceCents:      row.priceCents,
    currency:        row.currency,
    paymentMethod:   row.paymentMethod,
  });

  return new Response(pdfBuffer as any, {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="Invoice-${row.invoiceNumber}.pdf"`,
      'Content-Length':      String(pdfBuffer.length),
      // Prevent caching of potentially sensitive financial docs
      'Cache-Control':       'no-store',
    },
  });
}
