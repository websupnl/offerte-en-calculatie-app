import nodemailer from "nodemailer";
import { brandAssetUrl, DEFAULT_BRANDING, getBranding, gradientCssFromBranding, type CompanyBranding } from "@/lib/branding";
import { defaultQuoteExtensionMessage, defaultQuoteExtensionSubject } from "@/lib/quote-email-copy";

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
  accentGradient?: string;
};

// Verzendadressen zijn geverifieerde Brevo-senders. Wijzig hier als de sender
// in Brevo verandert; het "reply-to" adres is het echte bedrijfspostvak.
const COMPANY_EMAIL_IDENTITIES: Record<string, CompanyEmailIdentity> = {
  koolhaas: {
    fromName: "Koolhaas Installaties",
    fromEmail: "koolhaasinstallaties@onlinewerkplek.cloud",
    replyTo: "info@koolhaasinstallaties.nl",
    phone: "06 82 20 21 48",
    logoUrl: "/logos/koolhaas-wordmark-black.png",
    signatureImageUrl: "/signatures/daan-koolhaas-signature.png",
    signerName: "Daan Koolhaas",
    primaryColor: DEFAULT_BRANDING.koolhaas.primaryColor,
    accentColor: DEFAULT_BRANDING.koolhaas.accentColor,
  },
  websup: {
    fromName: "WebsUp",
    fromEmail: "websup.nl@onlinewerkplek.cloud",
    replyTo: "info@websup.nl",
    phone: "06 82 20 21 48",
    logoUrl: "/logos/websup-wordmark-black.png",
    signatureImageUrl: "/signatures/daan-koolhaas-signature.png",
    signerName: "Daan Koolhaas",
    primaryColor: DEFAULT_BRANDING.websup.primaryColor,
    accentColor: DEFAULT_BRANDING.websup.accentColor,
    accentGradient: "linear-gradient(135deg, #f97316 0%, #ec4899 50%, #a78bfa 100%)",
  },
};

export function getCompanyEmailIdentity(companySlug: string, overrides?: Partial<CompanyBranding>, companyId?: string): CompanyEmailIdentity {
  const base = COMPANY_EMAIL_IDENTITIES[companySlug] ?? COMPANY_EMAIL_IDENTITIES.websup;
  const branding = getBranding(companySlug, overrides);
  const logoUrl = branding.logoUrl.startsWith("s3://") && companyId
    ? brandAssetUrl(companyId, "logo", branding.logoUrl)
    : branding.logoUrl;
  return { ...base, logoUrl, primaryColor: branding.primaryColor, accentColor: branding.accentColor, accentGradient: gradientCssFromBranding(branding) };
}

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

function absoluteAssetUrl(path?: string) {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${getAppUrl()}${path}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToEmailHtml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
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

function renderEmailHeader(identity: CompanyEmailIdentity) {
  const logo = absoluteAssetUrl(identity.logoUrl);
  return `
    <tr><td class="email-header" style="padding:24px 32px; background:#ffffff;">
      ${logo
        ? `<img src="${logo}" alt="${escapeHtml(identity.fromName)}" height="60" style="height:60px; max-width:100%; width:auto; display:block;" />`
        : `<span style="color:${identity.primaryColor}; font-size:18px; font-weight:700;">${escapeHtml(identity.fromName)}</span>`
      }
    </td></tr>
    <tr><td style="height:3px; background:${identity.accentColor};${identity.accentGradient ? ` background-image:${identity.accentGradient};` : ""} font-size:0; line-height:0;">&nbsp;</td></tr>`;
}

// Gedeelde basis voor klantmails. Alleen de inhoud verschilt per type bericht.
export function renderEmailShell(identity: CompanyEmailIdentity, opts: { preheader?: string; bodyHtml: string }) {
  const signatureImg = absoluteAssetUrl(identity.signatureImageUrl);

  return `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <style>
    @media screen and (max-width:480px) {
      .email-outer { padding:12px !important; }
      .email-header, .email-content { padding:24px !important; }
      .email-button { display:block !important; text-align:center !important; }
    }
    @media (prefers-color-scheme:dark) {
      .email-bg { background-color:#0b1220 !important; }
      .email-card { background-color:#172033 !important; }
      .email-header { background-color:#ffffff !important; }
      .email-copy, .email-title { color:#f8fafc !important; }
      .email-muted { color:#cbd5e1 !important; }
      .email-content p, .email-content h1, .email-content blockquote { color:#f8fafc !important; }
      .email-content p.email-muted { color:#cbd5e1 !important; }
      .email-divider { border-color:#334155 !important; }
      .email-signature { display:none !important; }
      .email-button { background-color:#e2e8f0 !important; color:#0f172a !important; }
      .email-content a:not(.email-button) { color:#7dd3fc !important; }
    }
    [data-ogsc] .email-bg { background-color:#0b1220 !important; }
    [data-ogsc] .email-card { background-color:#172033 !important; }
    [data-ogsc] .email-header { background-color:#ffffff !important; }
    [data-ogsc] .email-copy, [data-ogsc] .email-title { color:#f8fafc !important; }
    [data-ogsc] .email-muted { color:#cbd5e1 !important; }
    [data-ogsc] .email-content p, [data-ogsc] .email-content h1, [data-ogsc] .email-content blockquote { color:#f8fafc !important; }
    [data-ogsc] .email-content p.email-muted { color:#cbd5e1 !important; }
    [data-ogsc] .email-divider { border-color:#334155 !important; }
    [data-ogsc] .email-signature { display:none !important; }
    [data-ogsc] .email-button { background-color:#e2e8f0 !important; color:#0f172a !important; }
    [data-ogsc] .email-content a:not(.email-button) { color:#7dd3fc !important; }
  </style>
</head>
<body class="email-bg" style="margin:0; padding:0; background:#f1f5f9; font-family:-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  ${opts.preheader ? `<div style="display:none; max-height:0; overflow:hidden;">${escapeHtml(opts.preheader)}</div>` : ""}
  <div class="email-outer" style="max-width:600px; margin:0 auto; padding:24px 16px;">
    <table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
      ${renderEmailHeader(identity)}
      <tr><td class="email-content email-copy" style="padding:32px; color:#1e293b; font-size:16px; line-height:1.6;">
        ${opts.bodyHtml}
        <div class="email-divider" style="margin-top:32px; padding-top:20px; border-top:1px solid #e2e8f0; font-size:16px;">
          <p class="email-muted" style="margin:0 0 4px 0; color:#475569;">Met vriendelijke groet,</p>
          ${signatureImg ? `<img class="email-signature" src="${signatureImg}" alt="Handtekening ${escapeHtml(identity.signerName)}" height="60" style="height:60px; width:auto; display:block; margin:6px 0;" />` : ""}
          <p class="email-copy" style="margin:2px 0; font-weight:700; color:#1e293b;">${escapeHtml(identity.signerName)}</p>
          <p class="email-muted" style="margin:2px 0; color:#475569;">${escapeHtml(identity.fromName)}</p>
          ${identity.phone ? `<p class="email-muted" style="margin:2px 0; color:#475569;">${escapeHtml(identity.phone)}</p>` : ""}
          <p class="email-muted" style="margin:2px 0; color:#475569;">${escapeHtml(identity.replyTo)}</p>
        </div>
      </td></tr>
    </table>
  </div>
</body>
</html>`.trim();
}

type QuoteEmailData = {
  to: string;
  customerName: string;
  companySlug: string;
  companyId?: string;
  companyBranding?: Partial<CompanyBranding>;
  quoteNumber: string;
  quoteTitle?: string;
  quoteUrl: string;
  totalIncVat?: string;
  validUntil?: string;
  introLine: string;
  // Eerste item is de offerte-PDF zelf; daarna eventueel gekoppelde datasheets/brochures.
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

// Alle klantmails gebruiken dezelfde responsieve basis; alleen de offerte-inhoud verschilt.
export function buildQuoteEmailHtml(identity: CompanyEmailIdentity, data: QuoteEmailData) {
  const formal = data.companySlug === "koolhaas";
  const quoteNumber = escapeHtml(data.quoteNumber);
  const heading = data.quoteTitle
    ? `Offerte voor ${escapeHtml(data.quoteTitle)}`
    : formal ? "Uw offerte staat klaar" : "Je offerte staat klaar";
  const details = [
    `<strong>Offertenummer:</strong> ${quoteNumber}`,
    data.totalIncVat ? `<strong>Totaal incl. btw:</strong> ${escapeHtml(data.totalIncVat)}` : null,
    data.validUntil ? `<strong>Geldig t/m:</strong> ${escapeHtml(data.validUntil)}` : null,
  ].filter(Boolean).join("<br />");
  const attachmentNames = data.attachments?.map((attachment) => escapeHtml(attachment.filename)) ?? [];
  const attachments = attachmentNames.length
    ? `<p class="email-muted" style="margin:24px 0 0; color:#475569; font-size:16px; overflow-wrap:anywhere;">Bijgevoegd: ${attachmentNames.join(", ")}</p>`
    : "";
  const bodyHtml = `
    <h1 class="email-title" style="margin:0 0 24px; color:${identity.primaryColor}; font-size:26px; line-height:1.25; overflow-wrap:anywhere;">${heading}</h1>
    <p class="email-copy" style="margin:0 0 16px; color:#1e293b; font-size:16px;">${formal ? "Beste" : "Hoi"} ${escapeHtml(data.customerName)},</p>
    <p class="email-copy" style="margin:0 0 24px; color:#1e293b; font-size:16px;">${textToEmailHtml(data.introLine)}</p>
    <p style="margin:0 0 24px;"><a class="email-button" href="${escapeHtml(data.quoteUrl)}" style="display:inline-block; background:${identity.primaryColor}; color:#ffffff; text-decoration:none; padding:13px 26px; border-radius:10px; font-size:16px; font-weight:700;">Offerte bekijken</a></p>
    <p class="email-muted" style="margin:0 0 16px; color:#475569; font-size:16px;">${formal ? "Liever niet klikken? U kunt ook op deze mail reageren met uw akkoord." : "Liever niet klikken? Je kunt ook op deze mail reageren met je akkoord."}</p>
    <p class="email-muted" style="margin:0 0 24px; color:#475569; font-size:16px;">${formal ? "Heeft u vragen of wilt u iets aanpassen? Reageer gerust op deze mail." : "Heb je vragen of wil je iets aanpassen? Reageer gerust op deze mail."}</p>
    <p class="email-copy" style="margin:0; color:#1e293b; font-size:16px; overflow-wrap:anywhere;">${details}</p>
    ${attachments}
  `;
  return renderEmailShell(identity, {
    preheader: `Offerte ${data.quoteNumber} van ${identity.fromName}`,
    bodyHtml,
  });
}

// Elke via de app verstuurde offerte gaat als kopie naar Donna's archiefpostbus.
// Overrulebaar via env voor test/staging.
const QUOTE_ARCHIVE_BCC = process.env.QUOTE_ARCHIVE_BCC ?? "donna@onlinewerkplek.cloud";

export async function sendQuoteEmail(data: QuoteEmailData) {
  const smtp = getTransporter();
  if (!smtp) return { sent: false, reason: "SMTP niet geconfigureerd" };

  const identity = getCompanyEmailIdentity(data.companySlug, data.companyBranding, data.companyId);

  await smtp.sendMail({
    from: `"${identity.fromName}" <${identity.fromEmail}>`,
    replyTo: identity.replyTo,
    to: data.to,
    bcc: QUOTE_ARCHIVE_BCC || undefined,
    subject: `Offerte ${data.quoteNumber} van ${identity.fromName}${data.quoteTitle ? `: ${data.quoteTitle}` : ""}`,
    html: buildQuoteEmailHtml(identity, data),
    text: [
      `${data.companySlug === "koolhaas" ? "Beste" : "Hoi"} ${data.customerName},`,
      data.introLine,
      `Offerte ${data.quoteNumber}${data.quoteTitle ? `: ${data.quoteTitle}` : ""}`,
      data.totalIncVat ? `Totaal incl. btw: ${data.totalIncVat}` : "",
      data.validUntil ? `Geldig t/m: ${data.validUntil}` : "",
      `Offerte bekijken: ${data.quoteUrl}`,
      data.companySlug === "koolhaas" ? "U kunt ook op deze mail reageren met uw akkoord." : "Je kunt ook op deze mail reageren met je akkoord.",
      `Vragen? Reageer op deze mail.`,
      `${identity.signerName}\n${identity.fromName}\n${identity.replyTo}`,
    ].filter(Boolean).join("\n\n"),
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

export function invoiceEmailConfigured() {
  return Boolean(getTransporter());
}

export async function sendInvoiceEmail(data: {
  to: string;
  customerName: string;
  companySlug: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string | null;
  paymentUrl: string;
  pdf: Buffer;
  filename: string;
}) {
  const smtp = getTransporter();
  if (!smtp) throw new Error("E-mail is nog niet ingesteld");
  const identity = getCompanyEmailIdentity(data.companySlug);
  const formal = data.companySlug === "koolhaas";
  const greeting = formal ? `Beste ${escapeHtml(data.customerName)},` : `Hoi ${escapeHtml(data.customerName)},`;
  const intro = formal
    ? `Bijgevoegd vindt u factuur <strong>${escapeHtml(data.invoiceNumber)}</strong> van ${escapeHtml(identity.fromName)}.`
    : `Bijgevoegd vind je factuur <strong>${escapeHtml(data.invoiceNumber)}</strong> van ${escapeHtml(identity.fromName)}.`;
  const due = data.dueDate ? `Betaal uiterlijk ${escapeHtml(data.dueDate)}.` : "";
  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">${greeting}</p>
    <p style="margin:0 0 16px;font-size:16px;color:#1e293b;">${intro}</p>
    <p style="margin:0 0 24px;font-size:16px;color:#1e293b;"><strong>Te betalen: ${escapeHtml(data.amount)}</strong>${due ? `<br />${due}` : ""}</p>
    <p style="margin:0 0 24px;"><a class="email-button" href="${escapeHtml(data.paymentUrl)}" style="display:inline-block;background:${identity.primaryColor};color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:10px;font-size:16px;font-weight:700;">Betaal factuur online</a></p>
    <p style="margin:0 0 16px;font-size:16px;color:#475569;">De factuur met QR-code zit als PDF bij deze mail.</p>
    <p style="margin:0;font-size:16px;color:#475569;overflow-wrap:anywhere;">Werkt de knop niet? Open deze link: <a href="${escapeHtml(data.paymentUrl)}" style="color:${identity.primaryColor};">${escapeHtml(data.paymentUrl)}</a></p>
  `;
  const result = await smtp.sendMail({
    from: `"${identity.fromName}" <${identity.fromEmail}>`,
    replyTo: identity.replyTo,
    to: data.to,
    subject: `Factuur ${data.invoiceNumber} van ${identity.fromName}`,
    html: renderEmailShell(identity, { preheader: `Factuur ${data.invoiceNumber}: ${data.amount}`, bodyHtml }),
    text: [
      formal ? `Beste ${data.customerName},` : `Hoi ${data.customerName},`,
      formal
        ? `Bijgevoegd vindt u factuur ${data.invoiceNumber} van ${identity.fromName}.`
        : `Bijgevoegd vind je factuur ${data.invoiceNumber} van ${identity.fromName}.`,
      `Te betalen: ${data.amount}. ${due}`,
      `Betaal online: ${data.paymentUrl}`,
      "De factuur met QR-code is als PDF bijgevoegd.",
    ].join("\n\n"),
    attachments: [{ filename: data.filename, content: data.pdf, contentType: "application/pdf" }],
  });
  if (!result.accepted.some((address) => (typeof address === "string" ? address : address.address).toLowerCase() === data.to.toLowerCase())) {
    throw new Error("De mailserver heeft het klantadres niet geaccepteerd");
  }
  return result.messageId;
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
    <p style="margin:0 0 16px 0;"><strong>${escapeHtml(data.customerName)}</strong> heeft offerte <strong>${escapeHtml(data.quoteNumber)}</strong> geaccepteerd.</p>
    ${data.message ? `<blockquote style="border-left:3px solid #16a34a; padding-left:12px; margin:16px 0; color:#475569;">${textToEmailHtml(data.message)}</blockquote>` : ""}
    <p class="email-muted" style="margin:16px 0 0 0; color:#475569; font-size:16px;">Log in op het dashboard voor meer details.</p>
  `;

  await smtp.sendMail({
    from: `"${identity.fromName}" <${identity.fromEmail}>`,
    replyTo: identity.replyTo,
    to: data.to,
    subject: `Offerte ${data.quoteNumber} geaccepteerd door ${data.customerName}`,
    html: renderEmailShell(identity, { bodyHtml }),
    text: `${data.customerName} heeft offerte ${data.quoteNumber} geaccepteerd.${data.message ? `\n\n${data.message}` : ""}\n\nLog in op het dashboard voor meer details.`,
  });

  return { sent: true };
}

export async function sendDeclinedNotification(data: StatusEmailData) {
  const smtp = getTransporter();
  if (!smtp) return { sent: false, reason: "SMTP niet geconfigureerd" };
  const identity = getCompanyEmailIdentity(data.companySlug);

  const bodyHtml = `
    <p style="margin:0 0 12px 0; color:#dc2626; font-weight:700; font-size:16px;">Offerte afgewezen</p>
    <p style="margin:0 0 16px 0;"><strong>${escapeHtml(data.customerName)}</strong> heeft offerte <strong>${escapeHtml(data.quoteNumber)}</strong> afgewezen.</p>
    ${data.message ? `<blockquote style="border-left:3px solid #dc2626; padding-left:12px; margin:16px 0; color:#475569;">${textToEmailHtml(data.message)}</blockquote>` : ""}
    <p class="email-muted" style="margin:16px 0 0 0; color:#475569; font-size:16px;">Log in op het dashboard voor meer details.</p>
  `;

  await smtp.sendMail({
    from: `"${identity.fromName}" <${identity.fromEmail}>`,
    replyTo: identity.replyTo,
    to: data.to,
    subject: `Offerte ${data.quoteNumber} afgewezen door ${data.customerName}`,
    html: renderEmailShell(identity, { bodyHtml }),
    text: `${data.customerName} heeft offerte ${data.quoteNumber} afgewezen.${data.message ? `\n\n${data.message}` : ""}\n\nLog in op het dashboard voor meer details.`,
  });

  return { sent: true };
}

// Bevestiging naar de klant nadat een offerte handmatig op akkoord is gezet
// (mondelinge bevestiging). Bewust simpel gehouden.
export async function sendVerbalConfirmationEmail(data: {
  to: string;
  companySlug: string;
  customerName: string;
  quoteNumber: string;
  quoteTitle?: string | null;
}) {
  const smtp = getTransporter();
  if (!smtp) return { sent: false, reason: "SMTP niet geconfigureerd" };
  const identity = getCompanyEmailIdentity(data.companySlug);
  const formal = data.companySlug === "koolhaas";

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">${formal ? "Beste" : "Hoi"} ${escapeHtml(data.customerName)},</p>
    <p style="margin:0 0 16px 0;">Zoals besproken heb ik offerte <strong>${escapeHtml(data.quoteNumber)}</strong>${
      data.quoteTitle ? ` (${escapeHtml(data.quoteTitle)})` : ""
    } op akkoord gezet. ${formal ? "U hoeft" : "Je hoeft"} verder niets te doen; ik neem contact op over de planning.</p>
    <p style="margin:0;">Klopt er iets niet? Reageer dan op deze mail.</p>
  `;

  await smtp.sendMail({
    from: `"${identity.fromName}" <${identity.fromEmail}>`,
    replyTo: identity.replyTo,
    to: data.to,
    subject: `Bevestiging: offerte ${data.quoteNumber} akkoord`,
    html: renderEmailShell(identity, { bodyHtml }),
    text: `${formal ? "Beste" : "Hoi"} ${data.customerName},\n\nZoals besproken heb ik offerte ${data.quoteNumber}${data.quoteTitle ? ` (${data.quoteTitle})` : ""} op akkoord gezet. Ik neem contact op over de planning.\n\nKlopt er iets niet? Reageer dan op deze mail.`,
  });

  return { sent: true };
}

type QuoteExtendedEmailData = {
  to: string;
  companySlug: string;
  customerName: string;
  quoteNumber: string;
  quoteTitle?: string | null;
  validUntil: Date;
  portalUrl: string;
  note?: string;
  subject?: string;
  message?: string;
};

// Pure opbouw: dezelfde bewerkte tekst verschijnt in HTML en platte tekst.
export function buildQuoteExtendedEmailContent(data: QuoteExtendedEmailData) {
  const identity = getCompanyEmailIdentity(data.companySlug);
  const formal = data.companySlug === "koolhaas";

  const geldig = data.validUntil.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const message = data.message?.trim() || defaultQuoteExtensionMessage(data.companySlug);
  const subject = data.subject?.trim() || defaultQuoteExtensionSubject(data.companySlug, data.quoteNumber);

  const bodyHtml = `
    <p style="margin:0 0 16px 0;">${formal ? "Beste" : "Hoi"} ${escapeHtml(data.customerName)},</p>
    <p style="margin:0 0 16px 0;">${textToEmailHtml(message)}</p>
    <p style="margin:0 0 16px 0;">Offerte <strong>${escapeHtml(data.quoteNumber)}</strong>${
      data.quoteTitle ? ` (${escapeHtml(data.quoteTitle)})` : ""
    } is geldig tot <strong>${geldig}</strong>.</p>
    ${data.note ? `<p style="margin:0 0 16px 0;">${textToEmailHtml(data.note)}</p>` : ""}
    <p style="margin:0 0 24px 0;">
      <a class="email-button" href="${escapeHtml(data.portalUrl)}" style="display:inline-block; background:${identity.primaryColor}; color:#fff; text-decoration:none; padding:13px 26px; border-radius:10px; font-size:16px; font-weight:700;">Offerte bekijken</a>
    </p>
    <p style="margin:0; color:#475569; font-size:16px;">${formal ? "Heeft u vragen of wilt u iets aanpassen?" : "Heb je vragen of wil je iets aanpassen?"} Reageer gerust op deze mail.</p>
  `;

  return {
    subject,
    html: renderEmailShell(identity, { preheader: `Offerte ${data.quoteNumber} is geldig tot ${geldig}`, bodyHtml }),
    text: `${formal ? "Beste" : "Hoi"} ${data.customerName},\n\n${message}\n\nOfferte ${data.quoteNumber}${data.quoteTitle ? ` (${data.quoteTitle})` : ""} is geldig tot ${geldig}.${data.note ? `\n\n${data.note}` : ""}\n\nOfferte bekijken: ${data.portalUrl}\n\nVragen? Reageer op deze mail.`,
  };
}

// Naar de klant als een verlopen of afgewezen offerte weer opengezet wordt.
export async function sendQuoteExtendedEmail(data: QuoteExtendedEmailData) {
  const smtp = getTransporter();
  if (!smtp) return { sent: false, reason: "SMTP niet geconfigureerd" };
  const identity = getCompanyEmailIdentity(data.companySlug);
  await smtp.sendMail({
    from: `"${identity.fromName}" <${identity.fromEmail}>`,
    replyTo: identity.replyTo,
    to: data.to,
    ...buildQuoteExtendedEmailContent(data),
  });

  return { sent: true };
}
