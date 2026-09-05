// src/services/email.ts
// Email service using Resend
// Add to .env: RESEND_API_KEY=re_xxxx
//              DEV_EMAIL_OVERRIDE=chandabrian02@gmail.com  (routes ALL emails here if set)
//              RESEND_FROM_EMAIL=MedLink <noreply@yourdomain.com>  (verified sender domain)

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// If DEV_EMAIL_OVERRIDE is set, all emails route there (useful for demo/dev)
function resolveRecipient(actualEmail: string): string {
  return process.env.DEV_EMAIL_OVERRIDE || actualEmail;
}

// Use a verified sender domain in production; fall back to resend test sender in dev
function getSender(): string {
  return process.env.RESEND_FROM_EMAIL || 'MedLink <onboarding@resend.dev>';
}

// ── Send OTP ──────────────────────────────────────────────────────────────────
export async function sendOTPEmail(
  toEmail: string,
  recipientName: string,
  otp: string,
): Promise<void> {
  const recipient = resolveRecipient(toEmail);
  const isDev = !!process.env.DEV_EMAIL_OVERRIDE && recipient !== toEmail;

  const { error } = await resend.emails.send({
    from: getSender(),
    to: recipient,
    subject: `${otp} — Your MedLink verification code`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
         

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#1A1D2E;">Hello, ${recipientName}</p>
              <p style="margin:0 0 28px;font-size:14px;color:#5A5F7A;line-height:1.6;">
                Your verification code for MedLink is below. This code expires in <strong>5 minutes</strong>.
                ${isDev ? '<br><br><em style="color:#d97706;font-size:12px;">⚠ DEV MODE: This was meant for ' + toEmail + '</em>' : ''}
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background:#f0fdf4;border:2px dashed #166534;border-radius:14px;padding:28px;">
                    <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#166534;letter-spacing:2px;text-transform:uppercase;">Verification Code</p>
                    <p style="margin:0;font-size:42px;font-weight:800;color:#052e16;letter-spacing:10px;font-family:monospace;">${otp}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;font-size:13px;color:#9498B3;line-height:1.6;">
                If you didn't request this code, someone may be attempting to access your account.
                You can safely ignore this email — your account remains secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f9fc;padding:20px 40px;border-top:1px solid #eceef4;">
              <p style="margin:0;font-size:11px;color:#9498B3;text-align:center;">
                MedLink EMR &nbsp;·&nbsp; Copperbelt University &nbsp;·&nbsp; Zambia<br>
                This is an automated message — please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `.trim(),
  });

  if (error) {
    console.error('[EMAIL_SERVICE] Failed to send OTP:', error);
    throw new Error(`Email delivery failed: ${error.message}`);
  }

  console.log(`[EMAIL_SERVICE] OTP sent to ${recipient}${isDev ? ` (dev override for ${toEmail})` : ''}`);
}