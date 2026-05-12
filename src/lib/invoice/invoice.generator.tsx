import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';

// Studio info from env — set these in Coolify
function getStudio() {
  return {
    name:       process.env.STUDIO_NAME        ?? 'Paquita Pilates Reformer GbR',
    address:    process.env.STUDIO_ADDRESS     ?? 'Haußmannstr. 126',
    city:       process.env.STUDIO_CITY        ?? '70188 Stuttgart',
    country:    process.env.STUDIO_COUNTRY     ?? 'Germany',
    phone:      process.env.STUDIO_PHONE       ?? '',
    email:      process.env.STUDIO_EMAIL       ?? process.env.EMAIL_FROM ?? '',
    taxId:      process.env.STUDIO_TAX_ID      ?? '93150/09800', // Steuernummer (GbR freiberuflich)
    vatId:      process.env.STUDIO_VAT_ID      ?? '',            // USt-IdNr (if registered)
    // VAT rate as decimal, e.g. 0.19 for 19 % or 0 for Kleinunternehmer (§19 UStG)
    vatRate:    parseFloat(process.env.STUDIO_VAT_RATE ?? '0'),
    kleinunternehmer: (process.env.STUDIO_VAT_RATE ?? '0') === '0',
  };
}

export interface InvoiceData {
  invoiceNumber:   string;
  invoiceDate:     Date;
  dueDate:         Date;
  customerName:    string;
  customerEmail:   string;
  customerAddress: string | null;
  packageName:     string;
  creditsAmount:   number;
  creditType:      string;
  priceCents:      number;
  currency:        string;
  paymentMethod:   string;
}

// ─── Palette (matches app brand) ────────────────────────────────────────────
const C = {
  primary:  '#4e2b22',
  light:    '#6b3d32',
  accent:   '#c4a88a',
  bg:       '#fafafa',
  border:   '#ede8e5',
  muted:    '#8b6b5c',
  text:     '#1a1a1a',
  white:    '#ffffff',
};

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.white,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 52,
  },
  // Header bar
  headerBar: {
    backgroundColor: C.primary,
    marginHorizontal: -52,
    marginTop: -48,
    paddingHorizontal: 52,
    paddingVertical: 24,
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 9,
    color: C.accent,
    marginTop: 3,
  },
  // Two-column layout
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  col: {
    flex: 1,
  },
  colRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  sectionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  addressName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 9,
    color: C.text,
    lineHeight: 1.5,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  metaItem: {
    gap: 2,
  },
  metaLabel: {
    fontSize: 7,
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
  },
  // Invoice title
  invoiceTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
    marginBottom: 20,
  },
  // Table
  table: {
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.primary,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    backgroundColor: '#faf9f7',
  },
  tableCell: {
    fontSize: 9,
    color: C.text,
  },
  colDesc: { flex: 4 },
  colQty:  { flex: 1, textAlign: 'right' as const },
  colUnit: { flex: 2, textAlign: 'right' as const },
  colTotal:{ flex: 2, textAlign: 'right' as const },
  // Totals
  totalsBlock: {
    marginTop: 12,
    marginLeft: 'auto',
    width: 220,
    gap: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 9,
    color: C.muted,
  },
  totalValue: {
    fontSize: 9,
    color: C.text,
  },
  totalDivider: {
    borderTopWidth: 1,
    borderTopColor: C.primary,
    borderTopStyle: 'solid',
    marginVertical: 4,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: C.primary,
    borderRadius: 4,
  },
  grandTotalLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  grandTotalValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  // Payment box
  paymentBox: {
    marginTop: 28,
    padding: 14,
    backgroundColor: '#fdf8f5',
    borderWidth: 1,
    borderColor: C.accent,
    borderStyle: 'solid',
    borderRadius: 6,
  },
  paymentBoxTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
    marginBottom: 6,
  },
  paymentLine: {
    fontSize: 8.5,
    color: C.light,
    lineHeight: 1.6,
  },
  // Legal notice
  legalBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#f5f3f1',
    borderRadius: 4,
  },
  legalText: {
    fontSize: 7.5,
    color: C.muted,
    lineHeight: 1.5,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 52,
    right: 52,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
    paddingTop: 10,
    flexDirection: 'column',
  },
  footerText: {
    fontSize: 7,
    color: C.muted,
  },
  footerCenter: {
    fontSize: 7,
    color: C.muted,
    textAlign: 'center' as const,
    marginTop: 4,
  },
});

function fmt(cents: number, currency: string): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function creditTypeLabel(ct: string): string {
  const map: Record<string, string> = {
    mat_group: 'Mat Group Class',
    reformer_group: 'Reformer Group Class',
    private_session: 'Private Session',
    duo_group: 'Duo Group Class',
    general_group: 'General Group Class',
    online_class: 'Online Class',
    sound_healing: 'Sound Healing Session',
  };
  return map[ct] ?? ct;
}

// ─── PDF React component ─────────────────────────────────────────────────────
function InvoicePDF({ data, studio }: { data: InvoiceData; studio: ReturnType<typeof getStudio> }) {
  const vatRate     = studio.vatRate;
  const grossCents  = data.priceCents;
  // If VAT inclusive (standard): net = gross / (1 + rate)
  const netCents    = vatRate > 0 ? Math.round(grossCents / (1 + vatRate)) : grossCents;
  const vatCents    = grossCents - netCents;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pilateq.de';

  return (
    <Document
      title={`Invoice ${data.invoiceNumber}`}
      author={studio.name}
      subject="Credit Package Invoice"
    >
      <Page size="A4" style={styles.page}>

        {/* Header bar */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>{studio.name}</Text>
          <Text style={styles.headerSubtitle}>Boutique Pilates Studio</Text>
        </View>

        {/* Invoice title */}
        <Text style={styles.invoiceTitle}>Invoice / Rechnung</Text>

        {/* Meta row: invoice number + date + due date */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Invoice No.</Text>
            <Text style={styles.metaValue}>{data.invoiceNumber}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Invoice Date</Text>
            <Text style={styles.metaValue}>{fmtDate(data.invoiceDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Service Date</Text>
            <Text style={styles.metaValue}>{fmtDate(data.invoiceDate)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>{fmtDate(data.dueDate)}</Text>
          </View>
        </View>

        {/* From / To */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>From / Rechnungsaussteller</Text>
            <Text style={styles.addressName}>{studio.name}</Text>
            <Text style={styles.addressLine}>{studio.address}</Text>
            <Text style={styles.addressLine}>{studio.city}</Text>
            {studio.vatId  ? <Text style={styles.addressLine}>USt-IdNr.: {studio.vatId}</Text>   : null}
            {studio.phone  ? <Text style={styles.addressLine}>Tel: {studio.phone}</Text>         : null}
            {studio.email  ? <Text style={styles.addressLine}>{studio.email}</Text>              : null}
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionLabel}>To / Rechnungsempfänger</Text>
            <Text style={styles.addressName}>{data.customerName || 'Customer'}</Text>
            <Text style={styles.addressLine}>{data.customerEmail}</Text>
            {data.customerAddress ? <Text style={styles.addressLine}>{data.customerAddress}</Text> : null}
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
          </View>

          <View style={[styles.tableRow, styles.tableRowAlt]}>
            <View style={styles.colDesc}>
              <Text style={[styles.tableCell, { fontFamily: 'Helvetica-Bold', color: C.primary }]}>
                {data.packageName}
              </Text>
              <Text style={[styles.tableCell, { color: C.muted, marginTop: 2 }]}>
                {data.creditsAmount}× {creditTypeLabel(data.creditType)} credits
              </Text>
              <Text style={[styles.tableCell, { color: C.muted, marginTop: 1 }]}>
                Pay at Studio — due {fmtDate(data.dueDate)}
              </Text>
            </View>
            <Text style={[styles.tableCell, styles.colQty]}>1</Text>
            <Text style={[styles.tableCell, styles.colUnit]}>{fmt(grossCents, data.currency)}</Text>
            <Text style={[styles.tableCell, styles.colTotal, { fontFamily: 'Helvetica-Bold' }]}>
              {fmt(grossCents, data.currency)}
            </Text>
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          {vatRate > 0 ? (
            <>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Net amount (Netto)</Text>
                <Text style={styles.totalValue}>{fmt(netCents, data.currency)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>VAT {Math.round(vatRate * 100)} % (MwSt.)</Text>
                <Text style={styles.totalValue}>{fmt(vatCents, data.currency)}</Text>
              </View>
            </>
          ) : null}
          <View style={styles.totalDivider} />
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total (Gesamtbetrag)</Text>
            <Text style={styles.grandTotalValue}>{fmt(grossCents, data.currency)}</Text>
          </View>
        </View>

        {/* Payment instructions */}
        <View style={styles.paymentBox}>
          <Text style={styles.paymentBoxTitle}>Payment Instructions / Zahlungshinweis</Text>
          <Text style={styles.paymentLine}>
            Please pay this invoice <Text style={{ fontFamily: 'Helvetica-Bold' }}>in person at the studio</Text> by {fmtDate(data.dueDate)}.
          </Text>
          <Text style={styles.paymentLine}>
            Bitte zahlen Sie diesen Betrag bis {fmtDate(data.dueDate)} direkt im Studio.
          </Text>
          <Text style={[styles.paymentLine, { marginTop: 6 }]}>
            Your credits are already available in your account at {appUrl}.
          </Text>
        </View>

        {/* Legal / VAT notice */}
        <View style={styles.legalBox}>
          {studio.kleinunternehmer ? (
            <Text style={styles.legalText}>
              Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen (Kleinunternehmerregelung).
              {'\n'}
              In accordance with § 19 UStG, no VAT is charged (small business regulation).
            </Text>
          ) : (
            <Text style={styles.legalText}>
              Alle Preise enthalten {Math.round(vatRate * 100)} % Mehrwertsteuer gemäß § 14 UStG.
            </Text>
          )}
          <Text style={[styles.legalText, { marginTop: 4 }]}>
            This document was generated electronically and is valid without a signature (§ 14 UStG).
            Dieses Dokument wurde elektronisch erstellt und ist ohne Unterschrift gültig (§ 14 UStG).
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
            <Text style={styles.footerText}>{studio.name} · {studio.address}, {studio.city}</Text>
            <Text style={styles.footerText}>{data.invoiceNumber} · {fmtDate(data.invoiceDate)}</Text>
          </View>
          {studio.taxId ? (
            <Text style={styles.footerCenter}>Steuernr.: {studio.taxId}</Text>
          ) : null}
        </View>

      </Page>
    </Document>
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────
export async function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  const studio = getStudio();
  // eslint-disable-next-line react/jsx-no-useless-fragment
  return renderToBuffer(<InvoicePDF data={data} studio={studio} />);
}
