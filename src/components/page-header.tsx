import Link from "next/link";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5 sm:mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      </div>
      {action && (
        <Link href={action.href} className="btn-primary">
          + {action.label}
        </Link>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="card-padded text-center py-12">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      {action && (
        <Link href={action.href} className="btn-primary mt-4 inline-flex">
          + {action.label}
        </Link>
      )}
    </div>
  );
}

export function StatusBadge({ status, colorClass }: { status: string; colorClass: string }) {
  return <span className={`badge ${colorClass}`}>{status.replace(/_/g, " ")}</span>;
}
