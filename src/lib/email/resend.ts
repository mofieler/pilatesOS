import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? 'onboarding@resend.dev';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'Pilates OS';

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
): Promise<void> {
  const link = `${APP_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}&identifier=${encodeURIComponent(email)}`;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Verify your email – ${APP_NAME}`,
    html: buildVerifyEmailHtml(name, link),
  });
}

function buildVerifyEmailHtml(name: string, link: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf9f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#4e2b22;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid #ede8e5;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#4e2b22 0%,#6b3d32 100%);padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:28px;font-weight:700;color:#faf9f7;letter-spacing:-0.5px;">${APP_NAME}</p>
            <p style="margin:8px 0 0;font-size:14px;color:#c4a88a;">Your boutique Pilates studio</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#4e2b22;">Verify your email address</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b3d32;line-height:1.6;">
              Hi ${name}, welcome! Click the button below to verify your email and activate your account.
            </p>
            <a href="${link}"
               style="display:block;background:linear-gradient(135deg,#4e2b22 0%,#6b3d32 100%);color:#faf9f7;text-align:center;padding:16px 24px;border-radius:12px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:0.2px;">
              Verify my email
            </a>
            <p style="margin:24px 0 0;font-size:13px;color:#8b6b5c;line-height:1.6;">
              This link expires in <strong>24 hours</strong>. If you didn't create an account, you can safely ignore this email.
            </p>
            <hr style="margin:24px 0;border:none;border-top:1px solid #ede8e5;">
            <p style="margin:0;font-size:12px;color:#a6856f;">
              Or copy this link into your browser:<br>
              <span style="color:#6b3d32;word-break:break-all;">${link}</span>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#faf9f7;padding:20px 40px;text-align:center;border-top:1px solid #ede8e5;">
            <p style="margin:0;font-size:12px;color:#a6856f;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
