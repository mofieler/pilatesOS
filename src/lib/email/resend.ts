import { Resend } from 'resend';

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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Pilates OS';

// Brand Colors - matching the app's brown palette
const COLORS = {
  primary: '#4e2b22',
  primaryLight: '#6b3d32',
  accent: '#c4a88a',
  background: '#faf9f7',
  surface: '#ffffff',
  border: '#ede8e5',
  text: '#4e2b22',
  textMuted: '#6b3d32',
  textLight: '#8b6b5c',
  textLighter: '#a6856f',
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
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
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
    
    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .content { padding: 24px 20px !important; }
      .header { padding: 28px 20px !important; }
      .button { width: 100% !important; display: block !important; text-align: center !important; }
      .title { font-size: 20px !important; }
    }
    
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #1a1a1a !important; }
      .card-bg { background-color: #242424 !important; }
      .text-primary { color: #faf9f7 !important; }
      .text-secondary { color: #c4a88a !important; }
      .text-body { color: #d4c8c0 !important; }
      .text-muted { color: #a09088 !important; }
      .border-color { border-color: #3a3a3a !important; }
      .footer-bg { background-color: #1f1f1f !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin: 0; padding: 0; background-color: ${COLORS.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${COLORS.text}; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  
  <!-- Preview text (hidden) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${greeting} ${body.replace(/<[^>]*>/g, '').substring(0, 100)}...
  </div>
  
  <!-- Main container -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="email-bg" style="background-color: ${COLORS.background};">
    <tr>
      <td style="padding: 40px 16px;">
        
        <!-- Card container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" class="container" style="max-width: 560px; margin: 0 auto; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(78, 43, 34, 0.08);" class="card-bg" bgcolor="${COLORS.surface}">
          
          <!-- Header with gradient -->
          <tr>
            <td class="header" style="background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%); padding: 32px 40px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <!-- Logo placeholder - can be replaced with actual logo image -->
                    <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: #faf9f7; letter-spacing: -0.5px; text-transform: none;">${APP_NAME}</h1>
                    <p style="margin: 8px 0 0; font-size: 13px; color: ${COLORS.accent}; font-weight: 400; letter-spacing: 0.3px;">Ihr Boutique Pilates Studio</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Body content -->
          <tr>
            <td class="content" style="padding: 40px; background-color: ${COLORS.surface};" class="card-bg">
              
              <!-- Greeting -->
              <p class="text-primary" style="margin: 0 0 8px; font-size: 16px; font-weight: 500; color: ${COLORS.primary};">${greeting}</p>
              
              <!-- Title -->
              <h1 class="text-primary title" style="margin: 0 0 20px; font-size: 24px; font-weight: 700; color: ${COLORS.primary}; line-height: 1.3;">${title}</h1>
              
              <!-- Body text -->
              <p class="text-body" style="margin: 0 0 28px; font-size: 15px; line-height: 1.7; color: ${COLORS.textMuted};">${body}</p>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 0 0 28px;">
                <tr>
                  <td>
                    <a href="${actionUrl}" class="button" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryLight} 100%); color: #faf9f7; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 600; text-align: center; box-shadow: 0 2px 8px rgba(78, 43, 34, 0.25); transition: transform 0.2s;">
                      ${actionText}
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Expiry notice -->
              <p class="text-muted" style="margin: 0 0 24px; font-size: 13px; line-height: 1.6; color: ${COLORS.textLight};">
                <span style="display: inline-block; margin-right: 6px;">⏱️</span>${expiryText}
              </p>
              
              <!-- Divider -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 24px 0;">
                <tr>
                  <td class="border-color" style="border-top: 1px solid ${COLORS.border}; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
              </table>
              
              <!-- Manual link fallback -->
              <p class="text-muted" style="margin: 0 0 8px; font-size: 12px; font-weight: 500; color: ${COLORS.textLighter}; text-transform: uppercase; letter-spacing: 0.5px;">Link funktioniert nicht?</p>
              <p class="text-muted" style="margin: 0; font-size: 12px; line-height: 1.6; color: ${COLORS.textLighter}; word-break: break-all;">
                Kopieren Sie diesen Link in Ihren Browser:<br>
                <a href="${actionUrl}" class="text-secondary" style="color: ${COLORS.primaryLight}; text-decoration: underline;">${actionUrl}</a>
              </p>
              
              ${footerText ? `
              <!-- Additional footer text -->
              <p class="text-muted" style="margin: 20px 0 0; font-size: 13px; line-height: 1.6; color: ${COLORS.textLight}; font-style: italic;">
                ${footerText}
              </p>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td class="footer-bg" style="background-color: ${COLORS.background}; padding: 24px 40px; text-align: center; border-top: 1px solid ${COLORS.border};" class="border-color">
              <p class="text-muted" style="margin: 0 0 8px; font-size: 12px; color: ${COLORS.textLighter};">
                &copy; ${new Date().getFullYear()} ${APP_NAME}. Alle Rechte vorbehalten.
              </p>
              <p class="text-muted" style="margin: 0; font-size: 11px; color: ${COLORS.textLighter};">
                Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht darauf.
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Footer links outside card -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 560px; margin: 20px auto 0;">
          <tr>
            <td style="text-align: center; padding: 0 20px;">
              <p style="margin: 0; font-size: 12px; color: ${COLORS.textLighter};">
                <a href="${APP_URL}" class="text-secondary" style="color: ${COLORS.primaryLight}; text-decoration: none;">Website besuchen</a>
                <span style="margin: 0 8px; color: ${COLORS.border};">|</span>
                <a href="${APP_URL}/privacy" class="text-secondary" style="color: ${COLORS.primaryLight}; text-decoration: none;">Datenschutz</a>
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
    subject: `E-Mail bestätigen – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'E-Mail bestätigen',
      title: 'E-Mail-Adresse bestätigen',
      greeting: `Hallo ${name},`,
      body: `willkommen bei ${APP_NAME}! Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren und alle Funktionen nutzen zu können.`,
      actionUrl: link,
      actionText: 'E-Mail bestätigen',
      expiryText: 'Dieser Link läuft in <strong>24 Stunden</strong> ab. Falls Sie kein Konto erstellt haben, können Sie diese E-Mail ignorieren.',
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
    subject: `Passwort zurücksetzen – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Passwort zurücksetzen',
      title: 'Passwort zurücksetzen',
      greeting: `Hallo ${name},`,
      body: 'wir haben eine Anfrage zum Zurücksetzen Ihres Passworts erhalten. Klicken Sie auf die Schaltfläche unten, um ein neues Passwort zu erstellen.',
      actionUrl: link,
      actionText: 'Passwort zurücksetzen',
      expiryText: 'Dieser Link läuft in <strong>1 Stunde</strong> ab. Falls Sie keine Zurücksetzung angefordert haben, ignorieren Sie diese E-Mail bitte.',
      footerText: 'Aus Sicherheitsgründen wird Ihr Passwort nicht geändert, wenn Sie nicht auf den Link klicken.',
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
      greeting: 'Guten Tag,',
      body: message,
      actionUrl: actionUrl ?? APP_URL,
      actionText: actionText ?? 'Jetzt ansehen',
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
  const link = `${APP_URL}/classes`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Buchungsbestätigung – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Buchungsbestätigung',
      title: 'Ihr Kurs ist bestätigt',
      greeting: `Hallo ${name},`,
      body: `Ihr Kurs <strong>"${classTitle}"</strong> am <strong>${classDate}</strong> um <strong>${classTime}</strong> wurde erfolgreich gebucht.`,
      actionUrl: link,
      actionText: 'Meine Kurse ansehen',
      expiryText: 'Bitte kommen Sie mindestens 10 Minuten vor Kursbeginn. Bei Verhinderung stornieren Sie bitte frühzeitig.',
    }),
  });
}

/**
 * Send a booking cancellation email
 */
export async function sendBookingCancellationEmail(
  email: string,
  name: string,
  classTitle: string,
  classDate: string,
): Promise<void> {
  const link = `${APP_URL}/classes`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Stornierungsbestätigung – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Stornierungsbestätigung',
      title: 'Kurs storniert',
      greeting: `Hallo ${name},`,
      body: `Ihr Kurs <strong>"${classTitle}"</strong> am <strong>${classDate}</strong> wurde erfolgreich storniert.`,
      actionUrl: link,
      actionText: 'Neuen Kurs buchen',
      expiryText: 'Ihr Guthaben wurde Ihrem Konto gutgeschrieben und steht Ihnen für zukünftige Buchungen zur Verfügung.',
    }),
  });
}

/**
 * Send welcome email after profile completion
 */
export async function sendWelcomeEmail(
  email: string,
  name: string,
): Promise<void> {
  const link = `${APP_URL}/classes`;

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Willkommen – ${APP_NAME}`,
    html: buildBaseTemplate({
      subject: 'Willkommen',
      title: `Willkommen bei ${APP_NAME}`,
      greeting: `Hallo ${name},`,
      body: `schön, dass Sie da sind! Ihr Konto ist jetzt vollständig eingerichtet. Entdecken Sie unsere Kursangebote und buchen Sie Ihre erste Pilates-Stunde.`,
      actionUrl: link,
      actionText: 'Kurse entdecken',
      expiryText: 'Haben Sie Fragen? Antworten Sie einfach auf diese E-Mail oder besuchen Sie uns im Studio.',
    }),
  });
}
