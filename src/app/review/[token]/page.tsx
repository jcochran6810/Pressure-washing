import { createServerClient } from "@supabase/ssr";
import { submitReview } from "./actions";

export const dynamic = "force-dynamic";

function publicClient(token: string) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: { getAll() { return []; }, setAll() {} },
      global: { headers: { "x-review-token": token } },
    },
  );
}

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return (
      <main className="min-h-screen grid place-items-center bg-gray-50">
        <p className="text-sm text-gray-600">Link not found.</p>
      </main>
    );
  }
  const supabase = publicClient(token);
  const { data: feedback } = await supabase
    .from("review_feedback")
    .select("id, rating, submitted_at, organizations(name, google_review_url)")
    .eq("token", token)
    .maybeSingle();

  if (!feedback) {
    return (
      <main className="min-h-screen grid place-items-center bg-gray-50">
        <p className="text-sm text-gray-600">Link not found.</p>
      </main>
    );
  }

  const submit = submitReview.bind(null, token);

  if (feedback.submitted_at) {
    return (
      <main className="min-h-screen grid place-items-center bg-gray-50 p-4">
        <div className="card-padded text-center">
          <h1 className="text-xl font-bold">Thanks!</h1>
          <p className="text-sm text-gray-600 mt-2">We've recorded your feedback.</p>
          {feedback.rating && feedback.rating >= 4 && (feedback.organizations as any)?.google_review_url && (
            <a href={(feedback.organizations as any).google_review_url} className="btn-primary mt-4 inline-flex" target="_blank" rel="noopener">
              Leave a Google review
            </a>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen grid place-items-center bg-gray-50 p-4">
      <div className="card-padded max-w-md w-full text-center">
        <h1 className="text-xl font-bold">How did we do?</h1>
        <p className="text-sm text-gray-600 mt-1">{(feedback.organizations as any)?.name}</p>
        <form action={submit} className="mt-5 space-y-4">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer">
                <input type="radio" name="rating" value={n} className="sr-only peer" defaultChecked={n === 5} />
                <span className="text-3xl text-gray-300 peer-checked:text-yellow-400 hover:text-yellow-300">★</span>
              </label>
            ))}
          </div>
          <textarea name="comment" rows={3} placeholder="What stood out? Anything we could improve?" className="w-full" />
          <button className="btn-primary w-full">Submit</button>
        </form>
      </div>
    </main>
  );
}
