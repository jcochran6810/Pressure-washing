import Link from "next/link";
import { subscriptionBanner, type OrgBilling } from "@/lib/billing";

export function SubscriptionBanner({ org }: { org: OrgBilling | null | undefined }) {
  const b = subscriptionBanner(org);
  if (!b) return null;

  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    error: "bg-red-50 border-red-200 text-red-900",
  }[b.tone];

  return (
    <div className={`border-b ${styles} px-4 sm:px-6 py-2 text-sm`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <strong className="mr-2">{b.title}.</strong>
          <span className="text-sm">{b.body}</span>
        </div>
        <Link href={b.ctaHref} className="text-sm font-medium underline whitespace-nowrap">
          {b.ctaLabel} →
        </Link>
      </div>
    </div>
  );
}
