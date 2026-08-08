import nodemailer from "nodemailer";
import { DEFAULT_BRANDING } from "@/lib/branding";

type CompanyEmailIdentity = {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  phone?: string;
  website: string;
  logoUrl?: string;
  signatureImageUrl?: string;
  photoUrl?: string;
  signerName: string;
  signerRole: string;
  primaryColor: string;
  accentColor: string;
  accentGradient?: string;
  backgroundColor: string;
  usps: string[];
};

// Verzendadressen zijn geverifieerde Brevo-senders. Wijzig hier als de sender
// in Brevo verandert; het "reply-to" adres is het echte bedrijfspostvak.
const COMPANY_EMAIL_IDENTITIES: Record<string, CompanyEmailIdentity> = {
  koolhaas: {
    fromName: "Koolhaas Installaties",
    fromEmail: "koolhaasinstallaties@onlinewerkplek.cloud",
    replyTo: "info@koolhaasinstallaties.nl",
    phone: "06 82 20 21 48",
    website: "koolhaasinstallaties.nl",
    logoUrl: "/logos/koolhaas-wordmark-black.png",
    signatureImageUrl: "/signatures/daan-koolhaas-signature.png",
    photoUrl: "/logos/daan-koolhaas.jpg",
    signerName: "Daan Koolhaas",
    signerRole: "Koolhaas Installaties",
    primaryColor: DEFAULT_BRANDING.koolhaas.primaryColor,
    accentColor: DEFAULT_BRANDING.koolhaas.accentColor,
    backgroundColor: DEFAULT_BRANDING.koolhaas.backgroundColor,
    usps: ["Deskundig advies op maat", "Vakkundige installatie", "Betrouwbare service & nazorg"],
  },
  websup: {
    fromName: "WebsUp",
    fromEmail: "websup.nl@onlinewerkplek.cloud",
    replyTo: "info@websup.nl",
    phone: "06 82 20 21 48",
    website: "websup.nl",
    logoUrl: "/logos/websup-wordmark-black.png",
    signatureImageUrl: "/signatures/daan-koolhaas-signature.png",
    photoUrl: "/logos/daan-koolhaas.jpg",
    signerName: "Daan Koolhaas",
    signerRole: "WebsUp.nl",
    primaryColor: DEFAULT_BRANDING.websup.primaryColor,
    accentColor: DEFAULT_BRANDING.websup.accentColor,
    accentGradient: "linear-gradient(135deg, #f97316 0%, #ec4899 50%, #a78bfa 100%)",
    backgroundColor: DEFAULT_BRANDING.websup.backgroundColor,
    usps: ["Maatwerk, geen standaardsjabloon", "Direct contact met de ontwikkelaar", "Blijvend onderhoud en support"],
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  // Eerste item is de offerte-PDF zelf; daarna eventueel gekoppelde datasheets/brochures.
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

// Offerte-uitnodiging: eyebrow + titel, korte intro, CTA-knop, infokaart met
// offertegegevens, vertrouwensblok, ondertekening met foto en USP's.
function buildQuoteEmailHtml(identity: CompanyEmailIdentity, data: QuoteEmailData) {
  const logo = absoluteAssetUrl(identity.logoUrl);
  const signatureImg = absoluteAssetUrl(identity.signatureImageUrl);
  const photoImg = absoluteAssetUrl(identity.photoUrl);
  const font = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const customerName = escapeHtml(data.customerName);
  const quoteTitle = data.quoteTitle ? escapeHtml(data.quoteTitle) : undefined;
  const quoteNumber = escapeHtml(data.quoteNumber);

  const heading = quoteTitle ? `Offerte voor ${quoteTitle}` : "Uw offerte staat klaar";

  const infoRows = [
    { label: "Offertenummer", value: quoteNumber },
    data.totalIncVat ? { label: "Totaal incl. btw", value: escapeHtml(data.totalIncVat) } : null,
    data.validUntil ? { label: "Geldig t/m", value: escapeHtml(data.validUntil) } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  const infoRowsHtml = infoRows
    .map(
      (row, i) => `
        <tr>
          <td style="padding:${i === 0 ? "0" : "12px"} 0 0 0; border-top:${i === 0 ? "none" : "1px solid #e2e8f0"};">
            <p style="margin:0 0 2px 0; font-size:12px; color:#64748b;">${row.label}</p>
            <p style="margin:0; font-size:15px; font-weight:700; color:${identity.primaryColor};">${row.value}</p>
          </td>
        </tr>`
    )
    .join("");

  const uspsHtml = identity.usps
    .map(
      (usp) => `
        <tr>
          <td style="padding:0 0 10px 0; font-size:14px; color:#1e293b; vertical-align:top;">
            <span style="display:inline-block; width:16px; font-weight:700; color:${identity.accentColor};">&#10003;</span>
            <span>${escapeHtml(usp)}</span>
          </td>
        </tr>`
    )
    .join("");

  const contactLines = [
    identity.phone ? identity.phone : null,
    identity.replyTo,
    identity.website,
  ]
    .filter(Boolean)
    .map((line) => `<p style="margin:2px 0; font-size:13px; color:#64748b;">${line}</p>`)
    .join("");

  const attachments = data.attachments ?? [];
  const attachmentRows = attachments
    .map((att, i) => {
      const ext = (/\.([a-z0-9]+)$/i.exec(att.filename)?.[1] ?? "pdf").toUpperCase().slice(0, 4);
      const isFirst = i === 0;
      const title = isFirst ? "PDF-offerte bijgevoegd" : escapeHtml(att.filename);
      const subtitle = isFirst
        ? `${escapeHtml(att.filename)}${data.totalIncVat ? ` &middot; ${escapeHtml(data.totalIncVat)}` : ""}`
        : "Datasheet";
      return `
        <tr>
          <td style="padding:${isFirst ? "0" : "12px"} 0 0 0; border-top:${isFirst ? "none" : "1px solid #e2e8f0"};">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="width:36px; height:36px; background:${identity.primaryColor}; border-radius:8px; text-align:center; vertical-align:middle;">
                <span style="font-size:9px; font-weight:700; color:#ffffff; letter-spacing:0.5px;">${ext}</span>
              </td>
              <td style="padding-left:12px;">
                <p style="margin:0 0 2px 0; font-size:14px; font-weight:700; color:#1e293b;">${title}</p>
                <p style="margin:0; font-size:13px; color:#64748b;">${subtitle}</p>
              </td>
            </tr></table>
          </td>
        </tr>`;
    })
    .join("");

  const attachmentCard = attachments.length
    ? `
    <tr>
      <td style="padding:24px 32px 32px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${attachmentRows}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
    : "";

  return `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family:${font};">
  <div style="display:none; max-height:0; overflow:hidden;">Je offerte ${quoteNumber} staat klaar</div>
  <div style="max-width:600px; margin:0 auto; padding:24px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">

      <tr>
        <td style="padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                ${logo
                  ? `<img src="${logo}" alt="${identity.fromName}" height="60" style="height:60px; width:auto; display:block;" />`
                  : `<span style="font-size:18px; font-weight:700; color:${identity.primaryColor};">${identity.fromName}</span>`
                }
              </td>
              <td style="text-align:right; vertical-align:middle;">
                ${identity.phone ? `<p style="margin:0 0 2px 0; font-size:13px; color:#64748b;">${identity.phone}</p>` : ""}
                <p style="margin:0; font-size:13px; color:#64748b;">${identity.replyTo}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td style="height:3px; background:${identity.accentColor};${identity.accentGradient ? ` background-image:${identity.accentGradient};` : ""} font-size:0; line-height:0;">&nbsp;</td></tr>

      <tr>
        <td style="padding:32px 32px 0 32px;">
          <p style="margin:0 0 8px 0; font-size:12px; font-weight:700; letter-spacing:1px; color:${identity.accentColor}; text-transform:uppercase;">Uw offerte staat klaar</p>
          <h1 style="margin:0 0 6px 0; font-size:26px; line-height:1.25; font-weight:800; color:${identity.primaryColor};">${heading}</h1>
          <p style="margin:0 0 28px 0; font-size:14px; color:#94a3b8;">Offerte ${quoteNumber}</p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="width:58%; vertical-align:top; padding-right:20px;">
                <p style="margin:0 0 14px 0; font-size:16px; line-height:1.6; color:#1e293b;">Beste ${customerName},</p>
                <p style="margin:0 0 20px 0; font-size:16px; line-height:1.6; color:#1e293b;">${data.introLine}</p>
                <a href="${data.quoteUrl}" style="display:inline-block; background:${identity.accentColor};${identity.accentGradient ? ` background-image:${identity.accentGradient};` : ""} color:#ffffff; text-decoration:none; padding:13px 26px; border-radius:10px; font-weight:700; font-size:15px;">
                  Offerte bekijken &amp; accorderen
                </a>
                <p style="margin:24px 0 0 0; font-size:14px; line-height:1.6; color:#64748b;">Liever niet klikken? Reageer gewoon op deze e-mail met je akkoord, dan verwerk ik het voor je.</p>
                <p style="margin:10px 0 0 0; font-size:14px; line-height:1.6; color:#64748b;">Heb je nog vragen of wil je iets aanpassen? Laat het gerust weten.</p>
                <p style="margin:20px 0 4px 0; font-size:14px; color:#64748b;">Met vriendelijke groet,</p>
                ${signatureImg ? `<img src="${signatureImg}" alt="Handtekening ${identity.signerName}" height="80" style="height:80px; width:auto; display:block; margin-left:-6px;" />` : `<p style="margin:0; font-size:14px; font-weight:700; color:#1e293b;">${identity.signerName}</p>`}
              </td>
              <td style="width:42%; vertical-align:top;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${identity.backgroundColor}; border-radius:14px;">
                  <tr><td style="padding:18px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      ${infoRowsHtml}
                    </table>
                  </td></tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px; background:${identity.backgroundColor}; border-radius:14px;">
                  <tr><td style="padding:16px 18px;">
                    <p style="margin:0 0 2px 0; font-size:13px; font-weight:700; color:${identity.primaryColor};">Veilig &amp; betrouwbaar</p>
                    <p style="margin:0; font-size:12px; line-height:1.5; color:#64748b;">Je gegevens zijn veilig en de offerte is 100% vrijblijvend.</p>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="padding:32px 32px 0 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;">
            <tr><td style="padding-top:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:58%; vertical-align:top; padding-right:20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        ${photoImg ? `<td style="width:60px; vertical-align:top;"><img src="${photoImg}" alt="${identity.signerName}" width="56" height="56" style="width:56px; height:56px; border-radius:50%; display:block; object-fit:cover;" /></td>` : ""}
                        <td style="vertical-align:top; padding-left:${photoImg ? "12px" : "0"};">
                          <p style="margin:0; font-size:14px; font-weight:700; color:#1e293b;">${identity.signerName}</p>
                          <p style="margin:0 0 6px 0; font-size:13px; font-weight:600; color:${identity.accentColor};">${identity.signerRole}</p>
                          ${contactLines}
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="width:42%; vertical-align:top;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      ${uspsHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td>
      </tr>

      ${attachmentCard}
      ${attachmentCard ? "" : `<tr><td style="height:32px; font-size:0; line-height:0;">&nbsp;</td></tr>`}
    </table>
  </div>
</body>
</html>`.trim();
}

export async function sendQuoteEmail(data: QuoteEmailData) {
  const smtp = getTransporter();
  if (!smtp) return { sent: false, reason: "SMTP niet geconfigureerd" };

  const identity = getCompanyEmailIdentity(data.companySlug);

  await smtp.sendMail({
    from: `"${identity.fromName}" <${identity.fromEmail}>`,
    replyTo: identity.replyTo,
    to: data.to,
    subject: `Offerte ${data.quoteNumber} van ${identity.fromName}${data.quoteTitle ? `: ${data.quoteTitle}` : ""}`,
    html: buildQuoteEmailHtml(identity, data),
    attachments: data.attachments?.length
      ? data.attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType ?? "application/pdf",
        }))
      : undefined,
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
