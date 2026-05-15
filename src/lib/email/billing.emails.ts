import { getResend, FROM, APP_URL, APP_NAME, STUDIO_NAME, buildBaseTemplate, escapeHtml } from './_base';

export async function sendPurchaseConfirmationWithInvoice(
  email: string, name: string, packageName: string, creditsAmount: number,
  creditType: string, priceCents: number, currency: string, validityDays: number,
  invoiceNumber: string, dueDate: Date, pdfBuffer: Buffer | null,
): Promise<void> {
  const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency.toUpperCase() }).format(priceCents / 100);
  const dueDateStr = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const expiryDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
  const expiryStr  = expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Credit purchase confirmed – ${invoiceNumber} – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Credit purchase confirmation', title: 'Order confirmed – credits are active',
      greeting: `Hi ${name},`,
      body: `
        Thank you for your order. Your credits are active.<br><br>
        Your <strong>${creditsAmount} ${packageName}</strong> credits are valid until <strong>${expiryStr}</strong>.
        You can start booking classes right away.<br><br>
        <strong>Invoice No.:</strong> ${invoiceNumber}<br>
        <strong>Amount:</strong> ${formatted}<br>
        <strong>Payment due:</strong> ${dueDateStr}<br><br>
        Please settle the invoice amount at your next studio visit within 14 days. Your invoice is attached to this email as a PDF.
      `,
      actionUrl: APP_URL, actionText: 'Book a class',
      expiryText: `Payment is due in-studio by ${dueDateStr}. Invoice No. ${invoiceNumber}.`,
    }),
    ...(pdfBuffer ? { attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer }] } : {}),
  });
}

export async function sendPaymentReminderEmail(
  email: string, name: string, invoiceNumber: string, packageName: string,
  priceCents: number, currency: string, originalDueDate: Date, daysPastDue: number,
  pdfBuffer: Buffer, customMessage?: string,
): Promise<{ messageId: string | undefined }> {
  const formatted  = new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency.toUpperCase() }).format(priceCents / 100);
  const dueDateStr = originalDueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const overdueNote = daysPastDue > 0
    ? `<span style="color:#c45c4a;font-weight:600;">This invoice is ${daysPastDue} day${daysPastDue !== 1 ? 's' : ''} past due.</span><br><br>`
    : '';
  const customNote = customMessage
    ? `<div style="margin:16px 0;padding:14px 16px;background:#faf9f7;border-left:3px solid #c4a88a;border-radius:6px;font-size:14px;color:#4e2b22;">${escapeHtml(customMessage)}</div>`
    : '';

  const response = await getResend().emails.send({
    from: FROM, to: email,
    subject: `Payment reminder: ${invoiceNumber} – ${STUDIO_NAME}`,
    html: buildBaseTemplate({
      subject: `Payment reminder: Invoice ${invoiceNumber}`, title: 'A friendly payment reminder',
      greeting: `Hi ${name},`,
      body: `
        Thank you for being part of ${STUDIO_NAME}. We hope you're enjoying your classes!<br><br>
        ${overdueNote}We wanted to send a gentle reminder that the following invoice is still outstanding:
        ${customNote}
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0;border-radius:12px;overflow:hidden;background:#f5f7f5;border:1px solid #ede8e5;">
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">Invoice number</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">${invoiceNumber}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">Package</td><td style="padding:12px 16px;font-size:13px;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">${packageName}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">Amount due</td><td style="padding:12px 16px;font-size:14px;font-weight:700;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">${formatted}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;">Original due date</td><td style="padding:12px 16px;font-size:13px;color:#c45c4a;font-weight:600;text-align:right;">${dueDateStr}</td></tr>
        </table>
        Please settle this at your next visit to the studio. A copy of your invoice is attached to this email for your records.<br><br>
        If you have any questions or believe this has been sent in error, please don't hesitate to reach out — we're happy to help.
      `,
      actionUrl: `${APP_URL}/credits`, actionText: 'View my account',
      expiryText: 'We look forward to seeing you at the studio soon.',
    }),
    attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer }],
  });

  return { messageId: response.data?.id };
}

export async function sendInvoiceToCustomEmail(
  recipientEmail: string, invoiceNumber: string, packageName: string,
  priceCents: number, currency: string, pdfBuffer: Buffer, customMessage: string,
): Promise<{ messageId: string | undefined }> {
  const formatted = new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency.toUpperCase() }).format(priceCents / 100);

  const response = await getResend().emails.send({
    from: FROM, to: recipientEmail,
    subject: `Invoice ${invoiceNumber} – ${STUDIO_NAME}`,
    html: buildBaseTemplate({
      subject: `Invoice ${invoiceNumber}`, title: `Invoice ${invoiceNumber}`,
      greeting: 'Hello,',
      body: `
        <div style="margin:0 0 20px 0;padding:16px;background:#faf9f7;border-left:3px solid #c4a88a;border-radius:6px;font-size:14px;color:#4e2b22;line-height:1.6;">
          ${escapeHtml(customMessage)}
        </div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0;border-radius:12px;overflow:hidden;background:#f5f7f5;border:1px solid #ede8e5;">
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">Invoice number</td><td style="padding:12px 16px;font-size:13px;font-weight:600;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">${invoiceNumber}</td></tr>
          <tr><td style="padding:12px 16px;font-size:13px;color:#8b6b5c;">Package</td><td style="padding:12px 16px;font-size:13px;color:#4e2b22;text-align:right;">${packageName} — ${formatted}</td></tr>
        </table>
        Your invoice is attached to this email as a PDF.
      `,
      actionUrl: APP_URL, actionText: `Visit ${STUDIO_NAME}`,
      expiryText: `Invoice ${invoiceNumber} from ${STUDIO_NAME}.`,
    }),
    attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer }],
  });

  return { messageId: response.data?.id };
}
