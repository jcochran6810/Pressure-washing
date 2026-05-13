"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { PhotoAnnotator } from "@/components/photo-annotator";

type Photo = {
  id: string;
  url: string;
  annotated_url?: string | null;
  kind: string;
  caption?: string | null;
  created_at?: string | null;
  organization_id: string;
};

export function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [editing, setEditing] = useState<Photo | null>(null);
  if (!photos?.length) return <p className="text-sm text-gray-500">No photos yet.</p>;
  const grouped: Record<string, Photo[]> = { before: [], after: [], damage: [], reference: [], other: [] };
  photos.forEach((p) => {
    (grouped[p.kind] || grouped.other).push(p);
  });

  return (
    <div className="space-y-4">
      {(["before", "after", "damage", "reference", "other"] as const).map((k) => {
        const list = grouped[k];
        if (!list?.length) return null;
        return (
          <div key={k}>
            <h4 className="text-xs uppercase tracking-wider text-gray-500 mb-2">{k}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {list.map((p) => {
                const display = p.annotated_url || p.url;
                return (
                  <div key={p.id} className="block">
                    <a href={display} target="_blank" rel="noopener">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={display}
                        alt={p.caption ?? k}
                        className="w-full aspect-square object-cover rounded-md border border-gray-200"
                      />
                    </a>
                    {p.caption && <p className="text-xs text-gray-600 mt-1 truncate">{p.caption}</p>}
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-gray-400">{formatDate(p.created_at)}</p>
                      <button
                        type="button"
                        className="text-xs text-brand-700 hover:underline"
                        onClick={() => setEditing(p)}
                      >
                        {p.annotated_url ? "Edit marks" : "Annotate"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4 overflow-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full p-3">
            <PhotoAnnotator
              photoId={editing.id}
              imageUrl={editing.url}
              organizationId={editing.organization_id}
              onClose={() => {
                setEditing(null);
                if (typeof window !== "undefined") window.location.reload();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
