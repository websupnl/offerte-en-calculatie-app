import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque, Nunito } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { CompanyProvider } from "@/lib/company-context";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL
  ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://app.websup.nl");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Werkplek — WebsUp & Koolhaas Installaties",
    template: "%s — Werkplek",
  },
  description: "Offertes, projecten, taken, notities en agenda op één plek voor WebsUp & Koolhaas Installaties.",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Werkplek" },
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: "Werkplek — WebsUp & Koolhaas Installaties",
    title: "Werkplek — WebsUp & Koolhaas Installaties",
    description: "Offertes, projecten, taken, notities en agenda op één plek.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Werkplek — WebsUp & Koolhaas Installaties",
    description: "Offertes, projecten, taken, notities en agenda op één plek.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="nl"
      className={`${inter.variable} ${bricolageGrotesque.variable} ${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>

        <SessionProvider>
          <CompanyProvider>{children}</CompanyProvider>
        </SessionProvider>
        <Toaster richColors position="bottom-right" />
        <PwaRegister />
      </body>
    </html>
  );
}
