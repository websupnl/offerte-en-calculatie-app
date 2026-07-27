/**
 * Klantportaal-toegang. Geen wachtwoorden: de klant krijgt een magic link met
 * een geheim token, dat daarna in een httpOnly-cookie belandt zodat 'ie niet
 * elke keer de mail hoeft op te zoeken.
 *
 * Regel voor wat de klant ziet: alléén items met visibility SHARED. Standaard
 * staat alles op INTERNAL — delen is een bewuste actie, geen ongelukje.
 */

import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const PORTAL_COOKIE = "portal_token";

export type PortalSession = {
  id: string;
  companyId: string;
  customerId: string;
  projectId: string | null;
  name: string | null;
  canComment: boolean;
  canUpload: boolean;
};

/** Toegang ophalen bij een token, met alle vervaldatums gecontroleerd. */
export async function portalAccessByToken(token: string): Promise<PortalSession | null> {
  if (!token || token.length < 20) return null;

  const access = await prisma.portalAccess.findUnique({
    where: { token },
    select: {
      id: true, companyId: true, customerId: true, projectId: true,
      name: true, canComment: true, canUpload: true,
      revokedAt: true, expiresAt: true,
    },
  });
  if (!access) return null;
  if (access.revokedAt) return null;
  if (access.expiresAt && access.expiresAt < new Date()) return null;

  return {
    id: access.id,
    companyId: access.companyId,
    customerId: access.customerId,
    projectId: access.projectId,
    name: access.name,
    canComment: access.canComment,
    canUpload: access.canUpload,
  };
}

/** Toegang uit de cookie — voor API-routes die vanuit het portaal komen. */
export async function portalSessionFromCookie(): Promise<PortalSession | null> {
  const store = await cookies();
  const token = store.get(PORTAL_COOKIE)?.value;
  return token ? portalAccessByToken(token) : null;
}

export async function setPortalCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(PORTAL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
  });
}

export async function touchPortalAccess(id: string): Promise<void> {
  await prisma.portalAccess.update({ where: { id }, data: { lastSeenAt: new Date() } }).catch(() => {});
}

/**
 * Where-fragment voor alles wat deze klant mag zien. Bij een projectgebonden
 * toegang blijft het bij dat ene project; anders alles van de klant.
 */
export function portalScopeWhere(session: PortalSession) {
  return session.projectId
    ? { companyId: session.companyId, projectId: session.projectId }
    : { companyId: session.companyId, customerId: session.customerId };
}

