import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config (no Prisma, no bcrypt) — used by proxy/middleware
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // Providers defined in src/lib/auth.ts (server-only)
  callbacks: {
    authorized({ auth }) {
      return !!auth;
    },
  },
};
