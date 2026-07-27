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

export const metadata: Metadata = {
  title: "Offerte App",
  description: "Offerte- en calculatietool voor WebsUp & Koolhaas Installaties",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Werkplek" },
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
