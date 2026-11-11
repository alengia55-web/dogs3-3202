/** Public login identifier, not a credential. Do not derive access from editable contact settings. */
export const ADMIN_EMAIL = "info@kinokomeiodimoumeteoron.gr";

export function isOwnerEmail(value: unknown): value is string {
  return typeof value === "string" && value.trim().toLowerCase() === ADMIN_EMAIL;
}