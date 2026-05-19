// Pure helpers shared by the estimate routes. Lives outside actions.ts
// because that file is "use server" and may only export async functions.

// Returns true when an estimate is in a status we still consider editable.
// "draft" is editable; anything past that — sent / accepted / converted /
// declined — is locked because it's already been seen by the customer.
export function isEstimateEditable(status: string | null | undefined): boolean {
  return (status ?? "draft") === "draft";
}
