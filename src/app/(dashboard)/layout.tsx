import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { ConfirmProvider } from "@/components/confirm-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <ConfirmProvider>
      <WorkspaceShell userName={session.user.name}>{children}</WorkspaceShell>
    </ConfirmProvider>
  );
}
