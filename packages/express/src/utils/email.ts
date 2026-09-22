/**
 * Canonical form of an email address for storage and lookup: trimmed and
 * lowercased.
 *
 * RFC 5321 technically allows a case-sensitive local part, but no mainstream
 * provider treats it that way, and case drift ("Foo@x.com" vs "foo@x.com")
 * otherwise causes missed lookups and duplicate accounts. Deliberately does
 * NOT strip dots or +tags — those are distinct addresses at many providers.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
