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
        "flex flex-col gap-3 px-5 pb-2 pt-5 sm:flex-row sm:items-end sm:justify-between lg:px-8",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ws-accent)]">{eyebrow}</p>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight text-foreground lg:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-base leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
