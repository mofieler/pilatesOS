import React from 'react';
import path from 'path';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';

function getStudio() {
  return {
    name:     process.env.STUDIO_NAME      ?? 'PAQUITA PILATES GbR',
    address:  process.env.STUDIO_ADDRESS   ?? 'Haußmannstr. 126',
    city:     process.env.STUDIO_CITY      ?? '70188 Stuttgart',
    phone:    process.env.STUDIO_PHONE     ?? '+49 176 3061 4623',
    email:    process.env.STUDIO_EMAIL     ?? (process.env.EMAIL_FROM ?? 'fgennari.studio@gmail.com'),
    vatId:    process.env.STUDIO_VAT_ID    ?? '',
    taxId:    process.env.STUDIO_TAX_ID    ?? '',
    // STUDIO_VAT_RATE=0.19 for 19% VAT, 0 for Kleinunternehmer
    vatRate:  parseFloat(process.env.STUDIO_VAT_RATE ?? '0'),
    kleinunternehmer: (process.env.STUDIO_VAT_RATE ?? '0') === '0',
    bankName: process.env.STUDIO_BANK_NAME ?? 'KONTIST',
    bankIban: process.env.STUDIO_BANK_IBAN ?? '',
    bankBic:  process.env.STUDIO_BANK_BIC  ?? '',
    owners:   process.env.STUDIO_OWNERS    ?? 'Fiorella Gennari & Camila Fernanda Arriaza Orrego',
  };
}

export interface InvoiceData {
  invoiceNumber:   string;
  invoiceDate:     Date;
  dueDate:         Date;
  customerName:    string;
  customerEmail:   string;
  customerAddress: string | null;
  customerId?:     string | null;
  packageName:     string;
  creditsAmount:   number;
  creditType:      string;
  priceCents:      number;
  currency:        string;
  paymentMethod:   string;
}

// ─── Styles (clean white, minimal — matches invoice screenshot) ───────────────
const S = StyleSheet.create({
  page: {
    fontFamily:        'Helvetica',
    fontSize:          9,
    color:             '#1a1a1a',
    backgroundColor:   '#ffffff',
    paddingTop:        36,
    paddingBottom:     72,
    paddingHorizontal: 52,
  },

  // Logo
  logoWrap: { alignItems: 'center', marginBottom: 20 },
  logo:     { width: 110, height: 110 },

  // RECHNUNG/INVOICE heading
  headingWrap: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#1a1a1a',
    borderBottomStyle: 'solid',
    marginBottom:      18,
    paddingBottom:     5,
  },
  heading: {
    fontSize:   20,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },

  // Info row (customer left, invoice meta right)
  infoRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   18,
  },
  infoCol: { flex: 1 },

  infoLine: {
    flexDirection: 'row',
    marginBottom:  3,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    width:      68,
    fontSize:   9,
  },
  infoValue: { fontSize: 9 },

  // Thank-you text
  intro: { fontSize: 9, marginBottom: 14, lineHeight: 1.4 },

  // ── Table ──────────────────────────────────────────────────────────────────
  tableHeaderRow: {
    flexDirection:   'row',
    borderTopWidth:  1,
    borderTopColor:  '#1a1a1a',
    borderTopStyle:  'solid',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    borderBottomStyle: 'solid',
    paddingVertical:   5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize:   9,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection:      'row',
    borderBottomWidth:  0.5,
    borderBottomColor:  '#cccccc',
    borderBottomStyle:  'solid',
    paddingVertical:    7,
    paddingHorizontal:  4,
  },
  tableRowLast: {
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tableCell: { fontSize: 9 },

  colPos:   { width: 28 },
  colDesc1: { flex: 2 },
  colDesc2: { flex: 3 },
  colPrice: { width: 72, textAlign: 'right' as const },

  // ── Totals ─────────────────────────────────────────────────────────────────
  totalsWrap: {
    alignItems:   'flex-end',
    marginTop:    6,
  },
  totalsBlock: { width: 200 },

  totalRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: { fontSize: 9 },
  totalValue: { fontSize: 9 },

  grandRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      4,
    paddingTop:     4,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    borderTopStyle: 'solid',
  },
  grandLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  grandValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  // Due date
  dueSection: { marginTop: 28, marginBottom: 14 },
  dueLine:    { flexDirection: 'row' },
  dueLabel:   { fontFamily: 'Helvetica-Bold', fontSize: 9, width: 100 },
  dueValue:   { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  // Closing
  closing:   { fontSize: 9, marginBottom: 12, lineHeight: 1.4 },
  greeting:  { fontSize: 9, marginBottom: 4 },
  owners:    { fontSize: 9 },

  // Footer
  footer: {
    position: 'absolute',
    bottom:   20,
    left:     52,
    right:    52,
    alignItems: 'center',
  },
  footerLine: {
    fontSize:   7.5,
    color:      '#555555',
    textAlign:  'center' as const,
    lineHeight: 1.5,
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Info line helper ─────────────────────────────────────────────────────────
function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.infoLine}>
      <Text style={S.infoLabel}>{label}</Text>
      <Text style={S.infoValue}>{value}</Text>
    </View>
  );
}

// Number of filler rows shown in the table (to match the 5-row template look)
const TABLE_ROWS = 5;

// ─── PDF component ────────────────────────────────────────────────────────────
function InvoicePDF({
  data,
  studio,
}: {
  data:   InvoiceData;
  studio: ReturnType<typeof getStudio>;
}) {
  const vatRate    = studio.vatRate;
  const grossCents = data.priceCents;
  // Price is VAT-inclusive; extract net and VAT
  const netCents   = vatRate > 0 ? Math.round(grossCents / (1 + vatRate)) : grossCents;
  const vatCents   = grossCents - netCents;

  const logoSrc = path.join(process.cwd(), 'public', 'logo_transparent.png');

  const customerLabel = data.customerId
    ? data.customerId.replace(/-/g, '').slice(0, 8).toUpperCase()
    : '-';

  return (
    <Document
      title={`Rechnung ${data.invoiceNumber}`}
      author={studio.name}
      subject="Invoice / Rechnung"
    >
      <Page size="A4" style={S.page}>

        {/* Logo */}
        <View style={S.logoWrap}>
          <Image src={logoSrc} style={S.logo} />
        </View>

        {/* Heading */}
        <View style={S.headingWrap}>
          <Text style={S.heading}>RECHNUNG/INVOICE</Text>
        </View>

        {/* Customer info (left) | Invoice meta (right) */}
        <View style={S.infoRow}>
          <View style={S.infoCol}>
            <InfoLine label="Kundennr.:" value={customerLabel} />
            <InfoLine label="Name:"       value={data.customerName} />
            <InfoLine label="E-Mail:"     value={data.customerEmail} />
          </View>
          <View style={S.infoCol}>
            <InfoLine label="Rechnung Nr.:" value={data.invoiceNumber} />
            <InfoLine label="Datum:"         value={fmtDate(data.invoiceDate)} />
          </View>
        </View>

        {/* Intro text */}
        <Text style={S.intro}>
          Vielen Dank für Ihr Vertrauen. Ich stelle Ihnen hiermit folgende Leistungen in Rechnung:
        </Text>

        {/* ── Table ── */}
        {/* Header */}
        <View style={S.tableHeaderRow}>
          <Text style={[S.tableHeaderCell, S.colPos]}>Pos.</Text>
          <Text style={[S.tableHeaderCell, S.colDesc1]}>Beschreibung</Text>
          <Text style={[S.tableHeaderCell, S.colDesc2]}>{''}</Text>
          <Text style={[S.tableHeaderCell, S.colPrice]}>Gesamtpreis</Text>
        </View>

        {/* Row 1: item */}
        <View style={S.tableRow}>
          <Text style={[S.tableCell, S.colPos]}>1.</Text>
          <Text style={[S.tableCell, S.colDesc1]}>-</Text>
          <Text style={[S.tableCell, S.colDesc2]}>- {data.creditsAmount} credits</Text>
          <Text style={[S.tableCell, S.colPrice]}>
            {fmt(vatRate > 0 ? netCents : grossCents, data.currency)}
          </Text>
        </View>

        {/* Filler rows 2–TABLE_ROWS */}
        {Array.from({ length: TABLE_ROWS - 1 }, (_, i) => {
          const rowStyle = i === TABLE_ROWS - 2
            ? [S.tableRow, S.tableRowLast]
            : [S.tableRow];
          return (
            <View key={i} style={rowStyle}>
              <Text style={[S.tableCell, S.colPos]}>{i + 2}.</Text>
              <Text style={[S.tableCell, S.colDesc1]}>-</Text>
              <Text style={[S.tableCell, S.colDesc2]}>-</Text>
              <Text style={[S.tableCell, S.colPrice]}>{''}</Text>
            </View>
          );
        })}

        {/* ── Totals ── */}
        <View style={S.totalsWrap}>
          <View style={S.totalsBlock}>
            {vatRate > 0 && (
              <View style={S.totalRow}>
                <Text style={S.totalLabel}>{Math.round(vatRate * 100)}% VAT</Text>
                <Text style={S.totalValue}>{fmt(vatCents, data.currency)}</Text>
              </View>
            )}
            <View style={S.grandRow}>
              <Text style={S.grandLabel}>Gesamtsumme</Text>
              <Text style={S.grandValue}>{fmt(grossCents, data.currency)}</Text>
            </View>
          </View>
        </View>

        {/* Due date */}
        <View style={S.dueSection}>
          <View style={S.dueLine}>
            <Text style={S.dueLabel}>Fälligkeitsdatum:</Text>
            <Text style={S.dueValue}>{fmtDate(data.dueDate)}</Text>
          </View>
        </View>

        {/* Closing */}
        <Text style={S.closing}>
          Bei Rückfragen stehe ich selbstverständlich jederzeit gerne zur Verfügung.
        </Text>
        <Text style={S.greeting}>Mit freundlichen Grüßen</Text>
        {studio.owners ? <Text style={S.owners}>{studio.owners}</Text> : null}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerLine}>{studio.name}</Text>
          <Text style={S.footerLine}>
            {studio.address} x {studio.city}
            {studio.email ? ` x ${studio.email}` : ''}
            {studio.phone ? ` x ${studio.phone}` : ''}
          </Text>
          {(studio.vatId || studio.bankName || studio.bankIban) ? (
            <Text style={S.footerLine}>
              {studio.vatId ? `USt-ID-NR. ${studio.vatId}` : ''}
              {studio.vatId && studio.bankName ? ' x ' : ''}
              {studio.bankName ?? ''}
              {studio.bankIban ? ` x ${studio.bankIban}` : ''}
              {studio.bankBic ? ` x BIC: ${studio.bankBic}` : ''}
            </Text>
          ) : null}
        </View>

      </Page>
    </Document>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const studio = getStudio();
  // eslint-disable-next-line react/jsx-no-useless-fragment
  return renderToBuffer(<InvoicePDF data={data} studio={studio} />);
}
