import { notFound } from "next/navigation";
import { WorkbenchPreview } from "@/components/layout/workbench-preview";

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <WorkbenchPreview />;
}
