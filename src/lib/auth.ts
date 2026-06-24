import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma as unknown as Parameters<typeof PrismaAdapter>[0]),
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "ADMIN";
        // Load user's companies
        const companies = await prisma.companyUser.findMany({
          where: { userId: user.id! },
          include: { company: true },
        });
        token.companies = companies.map((cu) => ({
          id: cu.company.id,
          name: cu.company.name,
          slug: cu.company.slug,
          role: cu.role,
        }));
        // Default to first company
        if (companies.length > 0) {
          token.activeCompanyId = companies[0].company.id;
        }
      }
      // Handle company switch
      if (trigger === "update") {
        const requestedCompanyId =
          session?.activeCompanyId ??
          (session?.user as { activeCompanyId?: string } | undefined)?.activeCompanyId;
        const companies = (token.companies ?? []) as { id: string }[];

        if (requestedCompanyId && companies.some((company) => company.id === requestedCompanyId)) {
          token.activeCompanyId = requestedCompanyId;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.companies = token.companies as {
          id: string;
          name: string;
          slug: string;
          role: string;
        }[];
        session.user.activeCompanyId = token.activeCompanyId as string;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.password) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.password);
        if (!valid) return null;

        return user;
      },
    }),
  ],
});
