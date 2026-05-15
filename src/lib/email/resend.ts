import { Resend } from 'resend';
import React from 'react';
import { APP_CONFIG } from '@/constants/APP_CONFIG';

// Lazy init — avoids module-load crash when RESEND_API_KEY is not set
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not set');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? 'onboarding@resend.dev';
const APP_URL = APP_CONFIG.APP_URL;
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Pilateq';
const STUDIO_NAME = process.env.STUDIO_NAME ?? 'Paquita Pilates Studio';

// Brand Colors - matching the app's brown palette
// Note: Text colors use dark brown for light mode; dark mode CSS will override to white
const COLORS = {
  primary: '#4e2b22',
  primaryLight: '#6b3d32',
  accent: '#c4a88a',
  background: '#faf9f7',
  surface: '#ffffff',
  border: '#ede8e5',
  text: '#4e2b22',
  textMuted: '#4e2b22', // Use primary for better override in dark mode
  textLight: '#6b3d32',
  textLighter: '#8b6b5c',
};

interface EmailTemplateProps {
  subject: string;
  title: string;
  greeting: string;
  body: string;
  actionUrl: string;
  actionText: string;
  expiryText: string;
  footerText?: string;
}

/**
 * Unified base template with:
 * - Modern card design with soft shadows
 * - Dark mode support (prefers-color-scheme)
 * - Mobile-optimized (responsive padding)
 * - Outlook/Gmail compatible table layout
 * - Retina-ready typography
 */
function buildBaseTemplate(props: EmailTemplateProps): string {
  const { title, greeting, body, actionUrl, actionText, expiryText, footerText } = props;

  return `<!DOCTYPE html>
<html lang="en" style="color-scheme: light only;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* FORCE light mode only — prevents email clients from auto-darkening */
    :root { color-scheme: light only !important; }
    html { color-scheme: light only !important; }
    body { color-scheme: light only !important; }

    /* Outlook.com / Microsoft email dark mode prevention */
    [data-ogsc], [data-ogsb], [data-ogac], [data-ogab] {
      color: inherit !important;
      background-color: inherit !important;
    }

    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }

    /* iOS blue links fix */
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }

    /* Responsive styles for mobile */
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
      .card-outer { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
      .content { padding: 20px 16px !important; box-sizing: border-box !important; }
      .header { padding: 20px 16px !important; box-sizing: border-box !important; }
      .card-footer { padding: 16px !important; box-sizing: border-box !important; }
      .button { width: 100% !important; display: block !important; text-align: center !important; box-sizing: border-box !important; }
      .title { font-size: 20px !important; }
      table { width: 100% !important; }
      td { width: 100% !important; box-sizing: border-box !important; }
    }

    /* PREVENT auto-dark-mode in email clients that ignore color-scheme.
       Force backgrounds and text to stay light-mode regardless of device theme.
       Combined with <font> tags and bgcolor attributes, this is bulletproof. */
    @media (prefers-color-scheme: dark) {
      /* Force light mode backgrounds */
      html, body, .email-wrap, .card-outer, .card-body, .card-footer {
        background-color: ${COLORS.surface} !important;
        color: ${COLORS.text} !important;
      }
      .email-bg, body[bgcolor], table[bgcolor] {
        background-color: ${COLORS.background} !important;
      }
      /* Force header to stay dark brown with white text */
      .header, td.header {
        background-color: ${COLORS.primary} !important;
      }
      .header-title, h1.header-title {
        color: #ffffff !important;
      }
      .header-subtitle {
        color: #e8d5b7 !important;
      }
      /* Force body text to stay readable dark on light */
      p, td, span, li, div, .card-body p, .card-body td {
        color: ${COLORS.text} !important;
      }
      h1, h2, h3, h4, h5, h6, .email-title, .title {
        color: ${COLORS.primary} !important;
      }
      /* Button stays dark with white text */
      .cta-button, a.cta-button {
        background-color: ${COLORS.primary} !important;
        color: #ffffff !important;
      }
    }

    /* Samsung-specific dark mode prevention */
    [data-ogsc] body, [data-ogsb] body {
      background-color: ${COLORS.background} !important;
    }
    [data-ogsc] .card-body, [data-ogsb] .card-body {
      background-color: ${COLORS.surface} !important;
      color: ${COLORS.text} !important;
    }
    [data-ogsc] .header, [data-ogsb] .header {
      background-color: ${COLORS.primary} !important;
    }
  </style>
</head>
<body class="email-wrap" style="margin: 0; padding: 0; background-color: ${COLORS.background}; color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${COLORS.text}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; word-break: break-word !important; -webkit-word-break: break-word !important;">
  
  <!-- Preview text (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${greeting} ${body.replace(/<[^>]*>/g, '').substring(0, 100)}...
  </div>
  
  <!-- Main container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-bg" style="background-color: ${COLORS.background};">
    <tr>
      <td style="padding: 40px 16px;">
        
        <!-- Card container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="container card-outer" style="max-width: 560px; margin: 0 auto; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(78, 43, 34, 0.08);" bgcolor="${COLORS.surface}">
          
          <!-- Header with solid color (no gradient for dark mode compatibility) -->
          <tr>
            <td class="header" bgcolor="${COLORS.primary}" style="background-color: ${COLORS.primary}; padding: 32px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;" align="center">
                    <!-- Using <font> tag — email clients cannot override this -->
                    <h1 class="header-title" style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff;">
                      <font color="#ffffff" style="color: #ffffff;">${APP_NAME}</font>
                    </h1>
                    <p class="header-subtitle" style="margin: 8px 0 0; font-size: 13px; font-weight: 400; letter-spacing: 0.3px; color: #e8d5b7;">
                      <font color="#e8d5b7" style="color: #e8d5b7;">Boutique Pilates Studio Booking System</font>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Body content -->
          <tr>
            <td class="content card-body" bgcolor="${COLORS.surface}" style="padding: 40px; background-color: ${COLORS.surface};">

              <!-- Greeting -->
              <p style="margin: 0 0 8px; font-size: 16px; font-weight: 500; color: ${COLORS.primary};">
                <font color="${COLORS.primary}" style="color: ${COLORS.primary};">${greeting}</font>
              </p>

              <!-- Title -->
              <h1 class="email-title title" style="margin: 0 0 20px; font-size: 24px; font-weight: 700; line-height: 1.3; color: ${COLORS.primary};">
                <font color="${COLORS.primary}" style="color: ${COLORS.primary};">${title}</font>
              </h1>

              <!-- Body text -->
              <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.7; color: ${COLORS.text};">
                <font color="${COLORS.text}" style="color: ${COLORS.text};">${body}</font>
              </p>

              <!-- CTA Button - using table-based bulletproof button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 28px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td bgcolor="${COLORS.primary}" style="background-color: ${COLORS.primary}; border-radius: 12px;">
                          <a href="${actionUrl}" class="button cta-button" style="display: inline-block; padding: 16px 32px; background-color: ${COLORS.primary}; border-radius: 12px; font-size: 15px; font-weight: 600; text-align: center; text-decoration: none; color: #ffffff;">
                            <font color="#ffffff" style="color: #ffffff;">${actionText}</font>
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Expiry notice -->
              <p style="margin: 0 0 24px; font-size: 13px; line-height: 1.6; color: ${COLORS.textLight};">
                <font color="${COLORS.textLight}" style="color: ${COLORS.textLight};">
                  <span style="display: inline-block; margin-right: 6px;">⏱️</span>${expiryText}
                </font>
              </p>

              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td style="border-top: 1px solid ${COLORS.border}; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Manual link fallback -->
              <p style="margin: 0 0 8px; font-size: 12px; font-weight: 500; color: ${COLORS.textLighter}; text-transform: uppercase; letter-spacing: 0.5px;">
                <font color="${COLORS.textLighter}" style="color: ${COLORS.textLighter};">Link not working?</font>
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: ${COLORS.textLighter}; word-break: break-all;">
                <font color="${COLORS.textLighter}" style="color: ${COLORS.textLighter};">
                  Copy this link into your browser:<br>
                  <a href="${actionUrl}" style="color: ${COLORS.primaryLight}; text-decoration: underline;"><font color="${COLORS.primaryLight}">${actionUrl}</font></a>
                </font>
              </p>

              ${footerText ? `
              <!-- Additional footer text -->
              <p style="margin: 20px 0 0; font-size: 13px; line-height: 1.6; color: ${COLORS.textLight}; font-style: italic;">
                <font color="${COLORS.textLight}" style="color: ${COLORS.textLight};">${footerText}</font>
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="card-footer" bgcolor="${COLORS.background}" style="background-color: ${COLORS.background}; padding: 24px 40px; text-align: center; border-top: 1px solid ${COLORS.border};">
              <p style="margin: 0 0 8px; font-size: 12px; color: ${COLORS.textLighter};">
                <font color="${COLORS.textLighter}" style="color: ${COLORS.textLighter};">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</font>
              </p>
              <p style="margin: 0; font-size: 11px; color: ${COLORS.textLighter};">
                <font color="${COLORS.textLighter}" style="color: ${COLORS.textLighter};">This email was sent automatically. Please do not reply.</font>
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Footer links outside card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px; margin: 20px auto 0;">
          <tr>
            <td style="text-align: center; padding: 0 20px;">
              <p style="margin: 0; font-size: 12px; color: ${COLORS.textLighter};">
                <a href="${APP_URL}" class="text-secondary" style="color: ${COLORS.primaryLight}; text-decoration: none;">Visit website</a>
                <span style="margin: 0 8px; color: ${COLORS.border};">|</span>
                <a href="${APP_URL}/privacy" class="text-secondary" style="color: ${COLORS.primaryLight}; text-decoration: none;">Privacy</a>
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>`;
}

// ============================================================================
// EMAIL BLOCK HELPERS
// ============================================================================

function buildClassInfoBlock(classTitle: string, classDate: string, classTime: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 4px; border-radius: 12px; overflow: hidden; border: 1px solid ${COLORS.border};">
      <tr>
        <td style="background-color: ${COLORS.background}; padding: 16px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="padding-bottom: 10px; border-bottom: 1px solid ${COLORS.border};">
                <p style="margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: ${COLORS.textLighter};">
                  <font color="${COLORS.textLighter}">Class</font>
                </p>
                <p style="margin: 4px 0 0; font-size: 15px; font-weight: 700; color: ${COLORS.primary};">
                  <font color="${COLORS.primary}">${classTitle}</font>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-top: 10px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                  <tr>
                    <td width="50%" style="vertical-align: top;">
                      <p style="margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: ${COLORS.textLighter};">
                        <font color="${COLORS.textLighter}">Date</font>
                      </p>
                      <p style="margin: 4px 0 0; font-size: 14px; font-weight: 600; color: ${COLORS.text};">
                        <font color="${COLORS.text}">${classDate}</font>
                      </p>
                    </td>
                    <td width="50%" style="vertical-align: top;">
                      <p style="margin: 0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: ${COLORS.textLighter};">
                        <font color="${COLORS.textLighter}">Time</font>
                      </p>
                      <p style="margin: 4px 0 0; font-size: 14px; font-weight: 600; color: ${COLORS.text};">
                        <font color="${COLORS.text}">${classTime}</font>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function buildCreditStatusBlock(refundIssued: boolean, adminCancelled = false): string {
  const isGreen = refundIssued;
  const bg      = isGreen ? '#f0faf0' : '#fff8f0';
  const border  = isGreen ? '#b2dfb2' : '#f5cba7';
  const icon    = isGreen ? '✓' : '✕';
  const iconBg  = isGreen ? '#4a7c4a' : '#c0392b';
  const label   = isGreen ? 'Credit refunded' : 'No refund issued';
  const detail  = adminCancelled
    ? 'Your credit has been fully refunded because the studio cancelled this class.'
    : refundIssued
      ? 'Cancelled more than 24 hours in advance — your credit has been returned to your account.'
      : 'Late cancellation (within 24 hours) — your credit could not be refunded per our cancellation policy.';

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 12px 0 0; border-radius: 12px; overflow: hidden; border: 1px solid ${border};">
      <tr>
        <td style="background-color: ${bg}; padding: 14px 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td width="32" style="vertical-align: middle; padding-right: 12px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td bgcolor="${iconBg}" style="background-color: ${iconBg}; border-radius: 50%; width: 28px; height: 28px; text-align: center; vertical-align: middle;">
                      <span style="font-size: 14px; font-weight: 700; color: #ffffff; line-height: 28px; display: block;">
                        <font color="#ffffff">${icon}</font>
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
              <td style="vertical-align: middle;">
                <p style="margin: 0; font-size: 13px; font-weight: 700; color: ${isGreen ? '#2d6a2d' : '#7b2d00'};">
                  <font color="${isGreen ? '#2d6a2d' : '#7b2d00'}">${label}</font>
                </p>
                <p style="margin: 3px 0 0; font-size: 12px; line-height: 1.5; color: ${isGreen ? '#3d7a3d' : '#8b4500'};">
                  <font color="${isGreen ? '#3d7a3d' : '#8b4500'}">${detail}</font>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
): Promise<void> {
  const link = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&identifier=${encodeURIComponent(email)}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Verify your email – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Verify email',
      title: 'Verify your email address',
      greeting: `Hi ${name},`,
      body: `welcome to ${APP_NAME}! Please verify your email address to activate your account and access all features.`,
      actionUrl: link,
      actionText: 'Verify email',
      expiryText: 'This link expires in <strong>24 hours</strong>. If you did not create an account, you can ignore this email.',
    }),
  });
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string,
): Promise<void> {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}&identifier=${encodeURIComponent(email)}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Reset your password – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Reset password',
      title: 'Reset password',
      greeting: `Hi ${name},`,
      body: 'we received a request to reset your password. Click the button below to create a new password.',
      actionUrl: link,
      actionText: 'Reset password',
      expiryText: 'This link expires in <strong>1 hour</strong>. If you did not request a reset, please ignore this email.',
      footerText: 'For security reasons, your password will not be changed unless you click the link.',
    }),
  });
}

/**
 * Send a generic notification email
 */
export async function sendNotificationEmail(
  email: string,
  subject: string,
  title: string,
  message: string,
  actionUrl?: string,
  actionText?: string,
): Promise<void> {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `${subject} – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject,
      title,
      greeting: 'Hello,',
      body: message,
      actionUrl: actionUrl ?? APP_URL,
      actionText: actionText ?? 'View now',
      expiryText: '',
    }),
  });
}

/**
 * Send a booking confirmation email
 */
export async function sendBookingConfirmationEmail(
  email: string,
  name: string,
  classTitle: string,
  classDate: string,
  classTime: string,
): Promise<void> {
  const link = `${APP_URL}`;

  const classInfoBlock = buildClassInfoBlock(classTitle, classDate, classTime);

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Booking confirmation – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Booking confirmation',
      title: 'Your class is confirmed ✓',
      greeting: `Hi ${name},`,
      body: `Your class has been successfully booked. See you on the mat!<br><br>${classInfoBlock}`,
      actionUrl: link,
      actionText: 'View my classes',
      expiryText: 'Please arrive at least 10 minutes before class starts. If you cannot attend, please cancel more than 24 hours before the class to receive a full credit refund.',
    }),
  });
}

/**
 * Send a booking cancellation email.
 * refundIssued controls whether we tell the user their credit was returned.
 */
export async function sendBookingCancellationEmail(
  email: string,
  name: string,
  classTitle: string,
  classDate: string,
  classTime: string,
  refundIssued: boolean,
): Promise<void> {
  const classInfoBlock    = buildClassInfoBlock(classTitle, classDate, classTime);
  const creditStatusBlock = buildCreditStatusBlock(refundIssued, false);

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Cancellation confirmation – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Cancellation confirmation',
      title: 'Booking cancelled',
      greeting: `Hi ${name},`,
      body: `Your booking has been successfully cancelled.<br><br>${classInfoBlock}${creditStatusBlock}`,
      actionUrl: APP_URL,
      actionText: 'Book a new class',
      expiryText: 'You can book another class anytime from the schedule.',
    }),
  });
}

/**
 * Send a class cancellation notice to a student when an admin/instructor cancels
 * the entire session. Credits are always fully refunded in this case.
 */
export async function sendClassCancelledByAdminEmail(
  email: string,
  name: string,
  classTitle: string,
  classDate: string,
  classTime: string,
  reason?: string,
): Promise<void> {
  const classInfoBlock    = buildClassInfoBlock(classTitle, classDate, classTime);
  const creditStatusBlock = buildCreditStatusBlock(true, true);
  const reasonNote        = reason ? `<p style="margin: 16px 0 0; font-size: 14px; color: ${COLORS.textLight};"><font color="${COLORS.textLight}"><strong>Reason:</strong> <em>${reason}</em></font></p>` : '';

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Class cancelled – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Class cancelled',
      title: 'Your class has been cancelled',
      greeting: `Hi ${name},`,
      body: `We're sorry to let you know that this class has been cancelled by the studio.<br><br>${classInfoBlock}${creditStatusBlock}${reasonNote}`,
      actionUrl: APP_URL,
      actionText: 'Browse other classes',
      expiryText: 'We apologise for the inconvenience. We hope to see you at another class soon.',
    }),
  });
}

/**
 * Send credit purchase confirmation with PDF invoice attached.
 * pdfBuffer is the raw @react-pdf/renderer output — pass null to skip attachment.
 */
export async function sendPurchaseConfirmationWithInvoice(
  email: string,
  name: string,
  packageName: string,
  creditsAmount: number,
  creditType: string,
  priceCents: number,
  currency: string,
  validityDays: number,
  invoiceNumber: string,
  dueDate: Date,
  pdfBuffer: Buffer | null,
): Promise<void> {
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(priceCents / 100);

  const dueDateStr = dueDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const expiryDate = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
  const expiryStr = expiryDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const html = buildBaseTemplate({
    subject: 'Credit purchase confirmation',
    title: 'Order confirmed – credits are active',
    greeting: `Hi ${name},`,
    body: `
      Thank you for your order. Your credits are active.<br><br>
      Your <strong>${creditsAmount} ${packageName}</strong> credits are valid until
      <strong>${expiryStr}</strong>. You can start booking classes right away.<br><br>
      <strong>Invoice No.:</strong> ${invoiceNumber}<br>
      <strong>Amount:</strong> ${formatted}<br>
      <strong>Payment due:</strong> ${dueDateStr}<br><br>
      Please settle the invoice amount at your next studio visit within 14 days.
      Your invoice is attached to this email as a PDF.
    `,
    actionUrl: `${APP_URL}`,
    actionText: 'Book a class',
    expiryText: `Payment is due in-studio by ${dueDateStr}. Invoice No. ${invoiceNumber}.`,
  });

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Credit purchase confirmed – ${invoiceNumber} – ${APP_NAME}`,
    html,
    ...(pdfBuffer
      ? {
          attachments: [
            {
              filename: `Invoice-${invoiceNumber}.pdf`,
              content: pdfBuffer,
            },
          ],
        }
      : {}),
  });
}

/**
 * Send welcome email after profile completion
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
): Promise<void> {
  const link = `${APP_URL}`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Welcome – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Welcome',
      title: `Welcome to ${APP_NAME}`,
      greeting: `Hi ${name},`,
      body: `great to have you here! ${APP_NAME} is the digital booking system for your classes at ${STUDIO_NAME} — explore our schedule and book your first Pilates session.`,
      actionUrl: link,
      actionText: 'Explore classes',
      expiryText: 'Have questions? Simply reply to this email or visit us at the studio.',
    }),
  });
}

/**
 * Send membership purchase confirmation with invoice details.
 * Sent immediately after admin creates the membership for a student.
 */
export async function sendMembershipPurchaseEmail(
  email: string,
  name: string,
  planName: string,
  weeklyCredits: number,
  creditType: string,
  durationWeeks: number,
  priceCents: number,
  currency: string,
  startsAt: Date,
  endsAt: Date,
  invoiceNumber: string,
  dueDate: Date,
  pdfBuffer: Buffer | null,
): Promise<void> {
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(priceCents / 100);

  const dueDateStr = dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const startStr   = startsAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const endStr     = endsAt.toLocaleDateString('en-GB',   { day: '2-digit', month: 'long', year: 'numeric' });

  const html = buildBaseTemplate({
    subject: 'Membership confirmed',
    title: 'Your membership is active',
    greeting: `Hi ${name},`,
    body: `
      Your <strong>${planName}</strong> membership is now active — welcome aboard!<br><br>
      ${buildClassInfoBlock(planName, startStr, '')}
      <br>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 12px 0;">
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: ${COLORS.text};">
            <strong>Credits per week:</strong> ${weeklyCredits} ${creditType} credit${weeklyCredits !== 1 ? 's' : ''}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: ${COLORS.text};">
            <strong>Duration:</strong> ${durationWeeks} week${durationWeeks !== 1 ? 's' : ''} (until ${endStr})
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: ${COLORS.text};">
            <strong>Invoice No.:</strong> ${invoiceNumber}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: ${COLORS.text};">
            <strong>Amount:</strong> ${formatted}
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: ${COLORS.text};">
            <strong>Payment due:</strong> ${dueDateStr}
          </td>
        </tr>
      </table>
      Credits are added automatically every week starting from ${startStr}.
      Please settle the invoice at the studio within 14 days. Your invoice is attached.
    `,
    actionUrl: `${APP_URL}/book`,
    actionText: 'Book a class',
    expiryText: `Membership active from ${startStr} to ${endStr}. Invoice No. ${invoiceNumber} due ${dueDateStr}.`,
  });

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Membership confirmed – ${planName} – ${APP_NAME}`,
    html,
    ...(pdfBuffer
      ? { attachments: [{ filename: `Invoice-${invoiceNumber}.pdf`, content: pdfBuffer }] }
      : {}),
  });
}

/**
 * Send weekly credit grant notification.
 * Triggered by the cron job each time credits are topped up for a membership.
 */
export async function sendMembershipCreditGrantEmail(
  email: string,
  name: string,
  planName: string,
  creditsAdded: number,
  creditType: string,
  newBalance: number,
  nextGrantDate: Date,
  endsAt: Date,
): Promise<void> {
  const nextStr = nextGrantDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const endStr  = endsAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = buildBaseTemplate({
    subject: 'Weekly credits added',
    title: 'Your weekly credits are here',
    greeting: `Hi ${name},`,
    body: `
      Your <strong>${planName}</strong> membership has topped up your balance. ${creditsAdded} ${creditType}
      credit${creditsAdded !== 1 ? 's' : ''} have been added to your account.<br><br>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 12px 0; border-radius: 12px; overflow: hidden; background: #f5f7f5;">
        <tr>
          <td style="padding: 14px 16px; font-size: 14px; color: ${COLORS.text};">
            <strong>Credits added:</strong> ${creditsAdded} ${creditType}
          </td>
        </tr>
        <tr>
          <td style="padding: 14px 16px; font-size: 14px; color: ${COLORS.text}; border-top: 1px solid #ede8e5;">
            <strong>New balance:</strong> ${newBalance} ${creditType} credit${newBalance !== 1 ? 's' : ''}
          </td>
        </tr>
        <tr>
          <td style="padding: 14px 16px; font-size: 14px; color: ${COLORS.text}; border-top: 1px solid #ede8e5;">
            <strong>Next top-up:</strong> ${nextStr}
          </td>
        </tr>
      </table>
      Your membership runs until <strong>${endStr}</strong>. Ready to book your next class?
    `,
    actionUrl: `${APP_URL}/book`,
    actionText: 'Book a class',
    expiryText: `Membership ends ${endStr}. Credits are added every week.`,
  });

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `${creditsAdded} credits added – ${planName} – ${APP_NAME}`,
    html,
  });
}

/**
 * Send a payment reminder to a client with the invoice PDF attached.
 * Tone: warm and professional — not threatening. First-contact dunning style.
 */
export async function sendPaymentReminderEmail(
  email: string,
  name: string,
  invoiceNumber: string,
  packageName: string,
  priceCents: number,
  currency: string,
  originalDueDate: Date,
  daysPastDue: number,
  pdfBuffer: Buffer,
  customMessage?: string,
): Promise<{ messageId: string | undefined }> {
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(priceCents / 100);

  const dueDateStr = originalDueDate.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const overdueNote = daysPastDue > 0
    ? `<span style="color:#c45c4a;font-weight:600;">This invoice is ${daysPastDue} day${daysPastDue !== 1 ? 's' : ''} past due.</span><br><br>`
    : '';

  const customNote = customMessage
    ? `<div style="margin:16px 0;padding:14px 16px;background:#faf9f7;border-left:3px solid #c4a88a;border-radius:6px;font-size:14px;color:#4e2b22;">${customMessage}</div>`
    : '';

  const html = buildBaseTemplate({
    subject: `Payment reminder: Invoice ${invoiceNumber}`,
    title: 'A friendly payment reminder',
    greeting: `Hi ${name},`,
    body: `
      Thank you for being part of ${STUDIO_NAME}. We hope you're enjoying your classes!<br><br>
      ${overdueNote}We wanted to send a gentle reminder that the following invoice is still outstanding:
      ${customNote}
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
        style="margin:12px 0;border-radius:12px;overflow:hidden;background:#f5f7f5;border:1px solid #ede8e5;">
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">
            Invoice number
          </td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">
            ${invoiceNumber}
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">
            Package
          </td>
          <td style="padding:12px 16px;font-size:13px;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">
            ${packageName}
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">
            Amount due
          </td>
          <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">
            ${formatted}
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#8b6b5c;">
            Original due date
          </td>
          <td style="padding:12px 16px;font-size:13px;color:#c45c4a;font-weight:600;text-align:right;">
            ${dueDateStr}
          </td>
        </tr>
      </table>
      Please settle this at your next visit to the studio. A copy of your invoice is attached to this email for your records.<br><br>
      If you have any questions or believe this has been sent in error, please don't hesitate to reach out — we're happy to help.
    `,
    actionUrl: `${APP_URL}/credits`,
    actionText: 'View my account',
    expiryText: 'We look forward to seeing you at the studio soon.',
  });

  const response = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Payment reminder: ${invoiceNumber} – ${STUDIO_NAME}`,
    html,
    attachments: [
      {
        filename: `Invoice-${invoiceNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  return { messageId: response.data?.id };
}

/**
 * Send an invoice to a custom email address, triggered by admin.
 * Includes the admin's custom message and the invoice PDF attached.
 */
export async function sendInvoiceToCustomEmail(
  recipientEmail: string,
  invoiceNumber: string,
  packageName: string,
  priceCents: number,
  currency: string,
  pdfBuffer: Buffer,
  customMessage: string,
): Promise<{ messageId: string | undefined }> {
  const formatted = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(priceCents / 100);

  const html = buildBaseTemplate({
    subject: `Invoice ${invoiceNumber}`,
    title: `Invoice ${invoiceNumber}`,
    greeting: 'Hello,',
    body: `
      <div style="margin:0 0 20px 0;padding:16px;background:#faf9f7;border-left:3px solid #c4a88a;border-radius:6px;font-size:14px;color:#4e2b22;line-height:1.6;">
        ${customMessage}
      </div>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"
        style="margin:12px 0;border-radius:12px;overflow:hidden;background:#f5f7f5;border:1px solid #ede8e5;">
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#8b6b5c;border-bottom:1px solid #ede8e5;">
            Invoice number
          </td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#4e2b22;border-bottom:1px solid #ede8e5;text-align:right;">
            ${invoiceNumber}
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#8b6b5c;">
            Package
          </td>
          <td style="padding:12px 16px;font-size:13px;color:#4e2b22;text-align:right;">
            ${packageName} — ${formatted}
          </td>
        </tr>
      </table>
      Your invoice is attached to this email as a PDF.
    `,
    actionUrl: APP_URL,
    actionText: `Visit ${STUDIO_NAME}`,
    expiryText: `Invoice ${invoiceNumber} from ${STUDIO_NAME}.`,
  });

  const response = await getResend().emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `Invoice ${invoiceNumber} – ${STUDIO_NAME}`,
    html,
    attachments: [
      {
        filename: `Invoice-${invoiceNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  return { messageId: response.data?.id };
}

/**
 * Send membership expiry notification.
 * Triggered by the cron job when a membership reaches its end date.
 */
export async function sendMembershipExpiryEmail(
  email: string,
  name: string,
  planName: string,
  endsAt: Date,
): Promise<void> {
  const endStr = endsAt.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const html = buildBaseTemplate({
    subject: 'Your membership has ended',
    title: 'Your membership has ended',
    greeting: `Hi ${name},`,
    body: `
      Your <strong>${planName}</strong> membership ended on <strong>${endStr}</strong>.<br><br>
      Any remaining credits from your membership are still in your account and can be used
      for booking classes. New weekly credit grants have stopped.<br><br>
      To continue your Pilates journey, visit us at the studio to renew your membership
      or purchase a credit package.
    `,
    actionUrl: `${APP_URL}/credits`,
    actionText: 'View credit options',
    expiryText: `Your membership ended on ${endStr}. Visit the studio to renew.`,
  });

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Membership ended – ${planName} – ${APP_NAME}`,
    html,
  });
}
