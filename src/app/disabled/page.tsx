import { PLATFORM_NAME } from "@/lib/platform";

export const dynamic = "force-dynamic";

export default function DisabledPage() {
  return (
    <main className="min-h-screen grid place-items-center p-6 bg-gray-50">
      <div className="card-padded max-w-md text-center">
        <h1 className="text-xl font-bold text-red-700">Account suspended</h1>
        <p className="text-gray-600 mt-3 text-sm">
          Access to this {PLATFORM_NAME} account has been temporarily disabled. Your data is
          preserved.
        </p>
        <p className="text-gray-500 mt-3 text-xs">
          Contact support to resolve the issue and re-enable the account.
        </p>
      </div>
    </main>
  );
}
