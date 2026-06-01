import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

type QuoteEmailData = {
  to: string;
  customerName: string;
  companyName: string;
  companyEmail: string;
  quoteNumber: string;
  quoteUrl: string;
  validUntil?: string;
};

export async function sendQuoteEmail(data: QuoteEmailData) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: `${data.companyName} <${data.companyEmail}>`,
    to: data.to,
    subject: `Offerte ${data.quoteNumber} van ${data.companyName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <h2 style="margin-bottom: 8px;">Beste ${data.customerName},</h2>
  <p style="color: #555; margin-bottom: 24px;">
    Bedankt voor uw interesse. Bijgaand ontvangt u onze offerte <strong>${data.quoteNumber}</strong>.
  </p>
  ${data.validUntil ? `<p style="color: #555;">Deze offerte is geldig t/m <strong>${data.validUntil}</strong>.</p>` : ""}
  <a href="${data.quoteUrl}" style="display: inline-block; background: #16A34A; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; margin: 16px 0;">
    Offerte bekijken &amp; accorderen →
  </a>
  <p style="color: #888; font-size: 13px; margin-top: 32px;">
    Vragen? Neem gerust contact op.<br/>
    Met vriendelijke groet,<br/>
    <strong>${data.companyName}</strong>
  </p>
</body>
</html>
    `.trim(),
  });
}

type AcceptedEmailData = {
  to: string;
  companyName: string;
  customerName: string;
  quoteNumber: string;
  message?: string;
};

export async function sendAcceptedNotification(data: AcceptedEmailData) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: `${data.companyName} <noreply@${process.env.RESEND_FROM_DOMAIN ?? "websup.nl"}>`,
    to: data.to,
    subject: `✅ Offerte ${data.quoteNumber} geaccepteerd door ${data.customerName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <h2 style="color: #16A34A;">Offerte geaccepteerd!</h2>
  <p><strong>${data.customerName}</strong> heeft offerte <strong>${data.quoteNumber}</strong> geaccepteerd.</p>
  ${data.message ? `<blockquote style="border-left: 4px solid #16A34A; padding-left: 12px; color: #555; margin: 16px 0;">${data.message}</blockquote>` : ""}
  <p style="color: #888; font-size: 13px; margin-top: 24px;">Log in op het dashboard voor meer details.</p>
</body>
</html>
    `.trim(),
  });
}

export async function sendDeclinedNotification(data: AcceptedEmailData) {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: `${data.companyName} <noreply@${process.env.RESEND_FROM_DOMAIN ?? "websup.nl"}>`,
    to: data.to,
    subject: `❌ Offerte ${data.quoteNumber} afgewezen door ${data.customerName}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <h2 style="color: #dc2626;">Offerte afgewezen</h2>
  <p><strong>${data.customerName}</strong> heeft offerte <strong>${data.quoteNumber}</strong> afgewezen.</p>
  ${data.message ? `<blockquote style="border-left: 4px solid #dc2626; padding-left: 12px; color: #555; margin: 16px 0;">${data.message}</blockquote>` : ""}
  <p style="color: #888; font-size: 13px; margin-top: 24px;">Log in op het dashboard voor meer details.</p>
</body>
</html>
    `.trim(),
  });
}
