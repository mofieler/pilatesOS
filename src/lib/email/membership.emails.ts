import { getResend, FROM, APP_URL, APP_NAME, buildBaseTemplate, buildClassInfoBlock, COLORS } from './_base';

export async function sendMembershipPurchaseEmail(
  email: string, name: string, planName: string, weeklyCredits: number, creditType: string,
  durationWeeks: number, priceCents: number, currency: string, startsAt: Date, endsAt: Date,
  invoiceNumber: string, dueDate: Date, pdfBuffer: Buffer | null,
): Promise<void> {
  const C = COLORS;
  const formatted  = new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency.toUpperCase() }).format(priceCents / 100);
  const dueDateStr = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  const startStr   = startsAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  const endStr     = endsAt.toLocaleDateString('en-GB',   { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Membership confirmed – ${planName} – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Membership confirmed', title: 'Your membership is active',
      greeting: `Hi ${name},`,
      body: `
        Your <strong>${planName}</strong> membership is now active — welcome aboard!<br><br>
        ${buildClassInfoBlock(planName, startStr, '')}
        <br>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0;">
          <tr><td style="padding:8px 0;font-size:14px;color:${C.text};"><strong>Credits per week:</strong> ${weeklyCredits} ${creditType} credit${weeklyCredits !== 1 ? 's' : ''}</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:${C.text};"><strong>Duration:</strong> ${durationWeeks} week${durationWeeks !== 1 ? 's' : ''} (until ${endStr})</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:${C.text};"><strong>Invoice No.:</strong> ${invoiceNumber}</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:${C.text};"><strong>Amount:</strong> ${formatted}</td></tr>
          <tr><td style="padding:8px 0;font-size:14px;color:${C.text};"><strong>Payment due:</strong> ${dueDateStr}</td></tr>
        </table>
        Credits are added automatically every week starting from ${startStr}.
        Please settle the invoice at the studio within 14 days. Your invoice is attached.
      `,
      actionUrl: `${APP_URL}/book`, actionText: 'Book a class',
      expiryText: `Membership active from ${startStr} to ${endStr}. Invoice No. ${invoiceNumber} due ${dueDateStr}.`,
    }),
    ...(pdfBuffer ? { attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer }] } : {}),
  });
}

export async function sendMembershipCreditGrantEmail(
  email: string, name: string, planName: string, creditsAdded: number,
  creditType: string, newBalance: number, nextGrantDate: Date, endsAt: Date,
): Promise<void> {
  const C = COLORS;
  const nextStr = nextGrantDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' });
  const endStr  = endsAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `${creditsAdded} credits added – ${planName} – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Weekly credits added', title: 'Your weekly credits are here',
      greeting: `Hi ${name},`,
      body: `
        Your <strong>${planName}</strong> membership has topped up your balance. ${creditsAdded} ${creditType}
        credit${creditsAdded !== 1 ? 's' : ''} have been added to your account.<br><br>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:12px 0;border-radius:12px;overflow:hidden;background:#f5f7f5;">
          <tr><td style="padding:14px 16px;font-size:14px;color:${C.text};"><strong>Credits added:</strong> ${creditsAdded} ${creditType}</td></tr>
          <tr><td style="padding:14px 16px;font-size:14px;color:${C.text};border-top:1px solid #ede8e5;"><strong>New balance:</strong> ${newBalance} ${creditType} credit${newBalance !== 1 ? 's' : ''}</td></tr>
          <tr><td style="padding:14px 16px;font-size:14px;color:${C.text};border-top:1px solid #ede8e5;"><strong>Next top-up:</strong> ${nextStr}</td></tr>
        </table>
        Your membership runs until <strong>${endStr}</strong>. Ready to book your next class?
      `,
      actionUrl: `${APP_URL}/book`, actionText: 'Book a class',
      expiryText: `Membership ends ${endStr}. Credits are added every week.`,
    }),
  });
}

export async function sendMembershipExpiryEmail(
  email: string, name: string, planName: string, endsAt: Date,
): Promise<void> {
  const endStr = endsAt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Membership ended – ${planName} – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Your membership has ended', title: 'Your membership has ended',
      greeting: `Hi ${name},`,
      body: `
        Your <strong>${planName}</strong> membership ended on <strong>${endStr}</strong>.<br><br>
        Any remaining credits from your membership are still in your account and can be used for booking classes.
        New weekly credit grants have stopped.<br><br>
        To continue your Pilates journey, visit us at the studio to renew your membership or purchase a credit package.
      `,
      actionUrl: `${APP_URL}/credits`, actionText: 'View credit options',
      expiryText: `Your membership ended on ${endStr}. Visit the studio to renew.`,
    }),
  });
}
