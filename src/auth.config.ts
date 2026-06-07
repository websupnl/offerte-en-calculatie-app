import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config (no Prisma, no bcrypt) — used by proxy/middleware
export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // Providers defined in src/lib/auth.ts (server-only)
  callbacks: {
    authorized({ auth }) {
      return !!auth;
    },
  },
};
