import { formatDate } from "@/lib/utils";

export function PhotoGallery({ photos }: { photos: any[] }) {
  if (!photos?.length) return <p className="text-sm text-gray-500">No photos yet.</p>;
  const grouped: Record<string, any[]> = { before: [], after: [], damage: [], reference: [], other: [] };
  photos.forEach((p) => { (grouped[p.kind] || grouped.other).push(p); });

  return (
    <div className="space-y-4">
      {(["before", "after", "damage", "reference", "other"] as const).map((k) => {
        const list = grouped[k];
        if (!list?.length) return null;
        return (
          <div key={k}>
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-2">{k}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {list.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noopener" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? k} className="w-full aspect-square object-cover rounded-md border border-gray-200" />
                  {p.caption && <p className="text-xs text-gray-600 mt-1 truncate">{p.caption}</p>}
                  <p className="text-xs text-gray-400">{formatDate(p.created_at)}</p>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
