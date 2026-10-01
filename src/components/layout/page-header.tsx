import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "workspace-page-header flex flex-col gap-4 px-5 pb-2 pt-7 xl:flex-row xl:flex-wrap xl:items-end xl:justify-between lg:px-8",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-sm font-medium text-muted-foreground">{eyebrow}</p>
        )}
        <div className="overflow-hidden pb-1"><h1 className="workspace-title text-2xl font-semibold leading-tight tracking-tight text-foreground lg:text-[30px]">{title}</h1></div>
        {description && <p className="mt-1 max-w-3xl text-base leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
