import Link from "next/link";
import { getSessionAndOrg } from "@/lib/org";
import { inviteMember, revokeInvite, removeMember } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { supabase, organizationId, organization } = await getSessionAndOrg();

  // Pull the current plan to know whether seats are allowed and how much they cost
  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("slug, name, seats_allowed, seat_amount")
    .eq("slug", (organization as any)?.subscription_plan ?? "starter")
    .maybeSingle();

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role, created_at, profiles!inner(id, full_name)")
      .eq("organization_id", organizationId),
    supabase
      .from("organization_invites")
      .select("id, email, role, expires_at, accepted_at, revoked_at, created_at")
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const seatsAllowed = plan?.seats_allowed === true;
  const seatPrice = Number(plan?.seat_amount ?? 5);
  const pendingInvites = invites ?? [];
  const memberCount = members?.length ?? 1;
  const additionalSeats = Math.max(0, memberCount - 1);

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">Team</h1>
      <p className="text-sm text-gray-500 mb-6">
        Invite employees so they can log in with their own credentials and have their own audit trail.
      </p>

      {!seatsAllowed ? (
        <div className="card-padded border-l-4 border-amber-400 bg-amber-50 mb-6">
          <p className="font-semibold mb-1">Team seats require Plus or Pro</p>
          <p className="text-sm text-gray-700">
            Your current plan ({plan?.name ?? "Starter"}) is single-user. Upgrade to add team members at <strong>${seatPrice}/user/month</strong>.
          </p>
          <Link href="/billing" className="btn-primary text-sm mt-3 inline-block">Upgrade plan</Link>
        </div>
      ) : (
        <div className="card-padded mb-6 bg-brand-50 border-brand-200">
          <p className="text-sm text-brand-900">
            <strong>{additionalSeats}</strong> additional {additionalSeats === 1 ? "seat" : "seats"} active ·{" "}
            <strong>${(additionalSeats * seatPrice).toFixed(2)}/month</strong> at ${seatPrice}/seat
          </p>
          {pendingInvites.length > 0 && (
            <p className="text-xs text-brand-700 mt-1">
              {pendingInvites.length} pending invite{pendingInvites.length === 1 ? "" : "s"} won&apos;t bill until accepted.
            </p>
          )}
        </div>
      )}

      <section className="card-padded mb-5">
        <h2 className="font-semibold mb-3">Team members</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((m: any) => (
              <tr key={m.user_id}>
                <td>{m.profiles?.full_name || m.user_id.slice(0, 8)}</td>
                <td><span className="badge bg-gray-100 text-gray-700 capitalize">{m.role}</span></td>
                <td className="text-xs text-gray-500">{new Date(m.created_at).toLocaleDateString()}</td>
                <td className="text-right">
                  {m.role !== "owner" && (
                    <form action={removeMember.bind(null, m.user_id)}>
                      <button className="btn-ghost text-red-600 text-xs">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {pendingInvites.length > 0 && (
        <section className="card-padded mb-5">
          <h2 className="font-semibold mb-3">Pending invites</h2>
          <table className="data-table">
            <thead><tr><th>Email</th><th>Role</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              {pendingInvites.map((i: any) => (
                <tr key={i.id}>
                  <td>{i.email}</td>
                  <td><span className="badge bg-gray-100 text-gray-700 capitalize">{i.role}</span></td>
                  <td className="text-xs text-gray-500">{new Date(i.expires_at).toLocaleDateString()}</td>
                  <td className="text-right">
                    <form action={revokeInvite.bind(null, i.id)}>
                      <button className="btn-ghost text-red-600 text-xs">Revoke</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {seatsAllowed && (
        <section className="card-padded">
          <h2 className="font-semibold mb-3">Invite a team member</h2>
          <p className="text-xs text-gray-500 mb-3">
            They&apos;ll get an email with a sign-up link. The seat charge of ${seatPrice}/month is added when they accept.
          </p>
          <form action={inviteMember} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label>Email</label>
              <input name="email" type="email" required className="w-full" placeholder="employee@company.com" />
            </div>
            <div>
              <label>Role</label>
              <select name="role" defaultValue="member" className="w-full">
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer (read-only)</option>
              </select>
            </div>
            <button className="btn-primary">Send invite</button>
          </form>
        </section>
      )}
    </div>
  );
}
