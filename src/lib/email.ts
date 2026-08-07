import nodemailer from "nodemailer";
import { DEFAULT_BRANDING } from "@/lib/branding";

type CompanyEmailIdentity = {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  phone?: string;
  logoUrl?: string;
  signatureImageUrl?: string;
  signerName: string;
  primaryColor: string;
  accentColor: string;
};

// Verzendadressen zijn geverifieerde Brevo-senders. Wijzig hier als de sender
// in Brevo verandert; het "reply-to" adres is het echte bedrijfspostvak.
const COMPANY_EMAIL_IDENTITIES: Record<string, CompanyEmailIdentity> = {
  koolhaas: {
    fromName: "Koolhaas Installaties",
    fromEmail: "koolhaasinstallaties@onlinewerkplek.cloud",
    replyTo: "info@koolhaasinstallaties.nl",
    phone: "06 82 20 21 48",
    logoUrl: "/logos/koolhaas-logo.png",
    signatureImageUrl: "/signatures/daan-koolhaas-signature.png",
    signerName: "Daan Koolhaas",
    primaryColor: DEFAULT_BRANDING.koolhaas.primaryColor,
    accentColor: DEFAULT_BRANDING.koolhaas.accentColor,
  },
  websup: {
    fromName: "WebsUp",
    fromEmail: "websup.nl@onlinewerkplek.cloud",
    replyTo: "info@websup.nl",
    logoUrl: "/logos/websup-color.png",
    signerName: "Daan Koolhaas",
    primaryColor: DEFAULT_BRANDING.websup.primaryColor,
    accentColor: DEFAULT_BRANDING.websup.accentColor,
  },
};

export function getCompanyEmailIdentity(companySlug: string): CompanyEmailIdentity {
  return COMPANY_EMAIL_IDENTITIES[companySlug] ?? COMPANY_EMAIL_IDENTITIES.websup;
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

function absoluteAssetUrl(path?: string) {
  if (!path) return undefined;
  return `${getAppUrl()}${path}`;
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.BREVO_SMTP_HOST;
  const port = process.env.BREVO_SMTP_PORT;
  const login = process.env.BREVO_SMTP_LOGIN;
  const key = process.env.BREVO_SMTP_KEY;
  if (!host || !port || !login || !key) return null;

  transporter = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: false, // STARTTLS op poort 587
    auth: { user: login, pass: key },
  });
  return transporter;
}

// Gedeelde e-mail-layout: kleurbalk in bedrijfshuisstijl, logo, inhoud, ondertekening.
function renderEmailShell(identity: CompanyEmailIdentity, opts: { preheader?: string; bodyHtml: string }) {
  const logo = absoluteAssetUrl(identity.logoUrl);
  const signatureImg = absoluteAssetUrl(identity.signatureImageUrl);

  return `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family: Arial, Helvetica, sans-serif;">
  ${opts.preheader ? `<div style="display:none; max-height:0; overflow:hidden;">${opts.preheader}</div>` : ""}
  <div style="max-width:600px; margin:0 auto; padding:24px 16px;">
    <div style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      <div style="background:${identity.primaryColor}; padding:20px 28px;">
        ${logo
          ? `<img src="${logo}" alt="${identity.fromName}" height="32" style="height:32px; width:auto; display:block;" />`
          : `<span style="color:#fff; font-size:18px; font-weight:700;">${identity.fromName}</span>`
        }
      </div>
      <div style="padding:32px 28px; color:#1e293b; font-size:14px; line-height:1.6;">
        ${opts.bodyHtml}
        <div style="margin-top:32px; padding-top:20px; border-top:1px solid #e2e8f0;">
          <p style="margin:0 0 4px 0; color:#64748b;">Met vriendelijke groet,</p>
          ${signatureImg ? `<img src="${signatureImg}" alt="Handtekening ${identity.signerName}" height="40" style="height:40px; width:auto; display:block; margin:6px 0;" />` : ""}
          <p style="margin:2px 0; font-weight:700; color:#1e293b;">${identity.signerName}</p>
          <p style="margin:2px 0; color:#64748b;">${identity.fromName}</p>
          ${identity.phone ? `<p style="margin:2px 0; color:#64748b;">${identity.phone}</p>` : ""}
          <p style="margin:2px 0; color:#64748b;">${identity.replyTo}</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`.trim();
}

type QuoteEmailData = {
  to: string;
  customerName: string;
  companySlug: string;
  quoteNumber: string;
  quoteTitle?: string;
  quoteUrl: string;
  totalIncVat?: string;
  validUntil?: string;
  introLine: string;
};

export async function sendQuoteEmail(data: QuoteEmailData) {
  const smtp = getTransporter();
  if (!smtp) return { sent: false, reason: "SMTP niet geconfigureerd" };

  const identity = getCompanyEmailIdentity(data.companySlug);

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">Beste ${data.customerName},</p>
    <p style="margin:0 0 20px 0;">${data.introLine}</p>
    <a href="${data.quoteUrl}" style="display:inline-block; background:${identity.accentColor}; color:#fff; text-decoration:none; padding:12px 28px; border-radius:8px; font-weight:700; font-size:14px;">
      Offerte bekijken &amp; accorderen
    </a>
    <table style="margin-top:24px; font-size:13px; color:#475569;">
      <tr><td style="padding:2px 12px 2px 0; color:#94a3b8;">Offertenummer</td><td style="font-weight:600;">${data.quoteNumber}</td></tr>
      ${data.totalIncVat ? `<tr><td style="padding:2px 12px 2px 0; color:#94a3b8;">Totaal incl. btw</td><td style="font-weight:600;">${data.totalIncVat}</td></tr>` : ""}
      ${data.validUntil ? `<tr><td style="padding:2px 12px 2px 0; color:#94a3b8;">Geldig t/m</td><td style="font-weight:600;">${data.validUntil}</td></tr>` : ""}
    </table>
  `;

  await smtp.sendMail({
    from: `"${identity.fromName}" <${identity.fromEmail}>`,
    replyTo: identity.replyTo,
    to: data.to,
    subject: `Offerte ${data.quoteNumber} van ${identity.fromName}${data.quoteTitle ? ` — ${data.quoteTitle}` : ""}`,
    html: renderEmailShell(identity, {
      preheader: `Je offerte ${data.quoteNumber} staat klaar`,
      bodyHtml,
    }),
  });

  return { sent: true };
}

type StatusEmailData = {
  to: string;
  companySlug: string;
  customerName: string;
  quoteNumber: string;
  message?: string;
};

export async function sendAcceptedNotification(data: StatusEmailData) {
  const smtp = getTransporter();
  if (!smtp) return { sent: false, reason: "SMTP niet geconfigureerd" };
  const identity = getCompanyEmailIdentity(data.companySlug);

  const bodyHtml = `
    <p style="margin:0 0 12px 0; color:#16a34a; font-weight:700; font-size:16px;">Offerte geaccepteerd</p>
    <p style="margin:0 0 16px 0;"><strong>${data.customerName}</strong> heeft offerte <strong>${data.quoteNumber}</strong> geaccepteerd.</p>
    ${data.message ? `<blockquote style="border-left:3px solid #16a34a; padding-left:12px; margin:16px 0; color:#475569;">${data.message}</blockquote>` : ""}
    <p style="margin:16px 0 0 0; color:#64748b; font-size:13px;">Log in op het dashboard voor meer details.</p>
  `;

  await smtp.sendMail({
    from: `"${identity.fromName}" <${identity.fromEmail}>`,
    replyTo: identity.replyTo,
    to: data.to,
    subject: `Offerte ${data.quoteNumber} geaccepteerd door ${data.customerName}`,
    html: renderEmailShell(identity, { bodyHtml }),
  });

  return { sent: true };
}

export async function sendDeclinedNotification(data: StatusEmailData) {
  const smtp = getTransporter();
  if (!smtp) return { sent: false, reason: "SMTP niet geconfigureerd" };
  const identity = getCompanyEmailIdentity(data.companySlug);

  const bodyHtml = `
    <p style="margin:0 0 12px 0; color:#dc2626; font-weight:700; font-size:16px;">Offerte afgewezen</p>
    <p style="margin:0 0 16px 0;"><strong>${data.customerName}</strong> heeft offerte <strong>${data.quoteNumber}</strong> afgewezen.</p>
    ${data.message ? `<blockquote style="border-left:3px solid #dc2626; padding-left:12px; margin:16px 0; color:#475569;">${data.message}</blockquote>` : ""}
    <p style="margin:16px 0 0 0; color:#64748b; font-size:13px;">Log in op het dashboard voor meer details.</p>
  `;

  await smtp.sendMail({
    from: `"${identity.fromName}" <${identity.fromEmail}>`,
    replyTo: identity.replyTo,
    to: data.to,
    subject: `Offerte ${data.quoteNumber} afgewezen door ${data.customerName}`,
    html: renderEmailShell(identity, { bodyHtml }),
  });

  return { sent: true };
}
