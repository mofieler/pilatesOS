import { getResend, FROM, APP_URL, APP_NAME, buildBaseTemplate, buildClassInfoBlock, buildCreditStatusBlock, COLORS } from './_base';

export async function sendBookingConfirmationEmail(
  email: string, name: string, classTitle: string, classDate: string, classTime: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Booking confirmation – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Booking confirmation', title: 'Your class is confirmed ✓',
      greeting: `Hi ${name},`,
      body: `Your class has been successfully booked. See you on the mat!<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}`,
      actionUrl: APP_URL, actionText: 'View my classes',
      expiryText: 'Please arrive at least 10 minutes before class starts. If you cannot attend, please cancel more than 24 hours before the class to receive a full credit refund.',
    }),
  });
}

export async function sendBookingCancellationEmail(
  email: string, name: string, classTitle: string, classDate: string, classTime: string, refundIssued: boolean,
): Promise<void> {
  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Cancellation confirmation – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Cancellation confirmation', title: 'Booking cancelled',
      greeting: `Hi ${name},`,
      body: `Your booking has been successfully cancelled.<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}${buildCreditStatusBlock(refundIssued, false)}`,
      actionUrl: APP_URL, actionText: 'Book a new class',
      expiryText: 'You can book another class anytime from the schedule.',
    }),
  });
}

export async function sendClassCancelledByAdminEmail(
  email: string, name: string, classTitle: string, classDate: string, classTime: string, reason?: string,
): Promise<void> {
  const C = COLORS;
  const reasonNote = reason
    ? `<p style="margin:16px 0 0;font-size:14px;color:${C.textLight};"><font color="${C.textLight}"><strong>Reason:</strong> <em>${reason}</em></font></p>`
    : '';

  await getResend().emails.send({
    from: FROM, to: email,
    subject: `Class cancelled – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Class cancelled', title: 'Your class has been cancelled',
      greeting: `Hi ${name},`,
      body: `We're sorry to let you know that this class has been cancelled by the studio.<br><br>${buildClassInfoBlock(classTitle, classDate, classTime)}${buildCreditStatusBlock(true, true)}${reasonNote}`,
      actionUrl: APP_URL, actionText: 'Browse other classes',
      expiryText: 'We apologise for the inconvenience. We hope to see you at another class soon.',
    }),
  });
}
