import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      activeCompanyId: string;
      companies: {
        id: string;
        name: string;
        slug: string;
        role: string;
      }[];
    } & DefaultSession["user"];
  }
}
