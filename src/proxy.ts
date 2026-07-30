import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  "/login",
  "/opengraph-image", // linkpreview-bots (WhatsApp, Slack, etc.) hebben geen sessie
  "/twitter-image",
  "/q/",
  "/print/portal/",
  "/api/auth",
  "/api/legal/",
  "/api/integrations/quote-contract",
  "/api/cli/",
  // Werkplek: klant heeft geen account, alleen een geheim token.
  "/portal/", // klantomgeving
  "/c/", // contract ondertekenen
  "/api/portal/", // feedback + reacties vanuit het portaal
  "/api/contracts/sign/", // handtekening zetten
  "/api/review/", // review-widget op klantsites
  "/review.js", // het widget-script zelf
  "/api/calendar/ics/", // ICS-feed: Google/Apple halen 'm op zonder browser
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === "/login" && req.auth) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
