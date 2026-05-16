"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; friendly_name: string | null; status: string };

export function MfaEnrollment() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setError(error.message); return; }
    setFactors((data?.totp ?? []) as Factor[]);
  }

  useEffect(() => { load(); }, []);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator (${new Date().toLocaleDateString()})`,
    });
    setBusy(false);
    if (error || !data) {
      setError(error?.message || "Could not start enrollment");
      return;
    }
    setEnrolling({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (chalErr || !challenge) {
      setBusy(false);
      setError(chalErr?.message || "Challenge failed");
      return;
    }
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: challenge.id,
      code: verifyCode.replace(/\s/g, ""),
    });
    setBusy(false);
    if (verifyErr) {
      setError(verifyErr.message);
      return;
    }
    setEnrolling(null);
    setVerifyCode("");
    await fetch("/api/security/mfa-enrolled", { method: "POST" });
    load();
  }

  async function unenroll(factorId: string) {
    if (!confirm("Remove this authenticator? You will lose 2FA protection.")) return;
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (factors.length <= 1) await fetch("/api/security/mfa-enrolled", { method: "DELETE" });
    load();
  }

  const verified = factors.filter((f) => f.status === "verified");

  if (enrolling) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
        <h3 className="font-semibold mb-2">Scan QR code</h3>
        <p className="text-sm text-gray-600 mb-3">
          Scan this with Google Authenticator, 1Password, Authy, or any TOTP app, then enter the 6-digit code below.
        </p>
        <div className="flex flex-wrap gap-4 items-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qrCode} alt="MFA QR code" className="w-40 h-40 bg-white p-2 border border-gray-200 rounded" />
          <div className="flex-1 min-w-[200px]">
            <p className="text-xs text-gray-500 mb-1">Or enter this secret manually:</p>
            <code className="block bg-white border border-gray-200 rounded p-2 text-xs break-all font-mono">{enrolling.secret}</code>
          </div>
        </div>
        <form onSubmit={verifyEnroll} className="mt-3 flex gap-2 items-end">
          <div className="flex-1">
            <label>6-digit code</label>
            <input
              type="text" inputMode="numeric" pattern="[0-9 ]{6,8}" required autoFocus
              value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)}
              className="w-full text-center text-lg tracking-widest" placeholder="000 000"
            />
          </div>
          <button disabled={busy} className="btn-primary">Verify</button>
          <button type="button" onClick={() => { setEnrolling(null); setVerifyCode(""); setError(null); }} className="btn-ghost text-sm">Cancel</button>
        </form>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {verified.length === 0 ? (
        <>
          <p className="text-sm text-gray-600 mb-3">
            Two-factor authentication adds a second step to log in. After your password, you&apos;ll enter a 6-digit code from an authenticator app.
          </p>
          <button onClick={startEnroll} disabled={busy} className="btn-secondary text-sm">
            {busy ? "Setting up…" : "Set up two-factor authentication"}
          </button>
        </>
      ) : (
        <>
          <div className="space-y-2 mb-2">
            {verified.map((f) => (
              <div key={f.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-2">
                <div>
                  <p className="text-sm font-medium">{f.friendly_name || "Authenticator"}</p>
                  <p className="text-xs text-green-700">Active</p>
                </div>
                <button onClick={() => unenroll(f.id)} disabled={busy} className="btn-ghost text-red-600 text-xs">Remove</button>
              </div>
            ))}
          </div>
          <button onClick={startEnroll} disabled={busy} className="btn-secondary text-xs">Add another authenticator</button>
        </>
      )}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
