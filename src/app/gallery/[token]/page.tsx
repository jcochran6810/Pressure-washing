import { createServerClient } from "@supabase/ssr";
import { formatDate } from "@/lib/utils";
import { PLATFORM_NAME } from "@/lib/platform";

export const dynamic = "force-dynamic";

function publicClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return []; }, setAll() {} } },
  );
}

export default async function PublicGalleryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = publicClient();
  const { data: gallery } = await supabase
    .from("public_galleries")
    .select("*, jobs(title, customers(first_name, last_name, company_name)), organizations(name)")
    .eq("token", token)
    .maybeSingle();
  if (!gallery) {
    return (
      <main className="min-h-screen grid place-items-center bg-gray-50">
        <p className="text-sm text-gray-600">Gallery not found.</p>
      </main>
    );
  }

  const { data: photos } = await supabase
    .from("photo_attachments")
    .select("*")
    .eq("job_id", gallery.job_id)
    .order("created_at");

  const before = (photos ?? []).filter((p) => p.kind === "before");
  const after = (photos ?? []).filter((p) => p.kind === "after");

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6">
          <p className="text-sm text-gray-500">{(gallery.organizations as any)?.name}</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{gallery.title || (gallery.jobs as any)?.title}</h1>
          <p className="text-sm text-gray-600">Before & after — {formatDate(gallery.created_at)}</p>
        </header>

        <section className="mb-6">
          <h2 className="font-semibold mb-3">Before</h2>
          {!before.length ? <p className="text-sm text-gray-500">No before photos.</p> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {before.map((p) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={p.id} src={p.url} alt="Before" className="w-full aspect-square object-cover rounded-lg shadow-sm" />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-semibold mb-3">After</h2>
          {!after.length ? <p className="text-sm text-gray-500">No after photos yet.</p> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {after.map((p) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={p.id} src={p.url} alt="After" className="w-full aspect-square object-cover rounded-lg shadow-sm" />
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-gray-400 mt-10">Powered by {PLATFORM_NAME}</p>
      </div>
    </main>
  );
}
