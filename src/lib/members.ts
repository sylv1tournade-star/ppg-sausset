export type ParsedMemberRow = {
  firstName: string;
  lastName: string;
  normalizedKey: string;
};

export function normalizePersonName(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function memberKey(firstName: string, lastName: string) {
  return `${normalizePersonName(firstName)}|${normalizePersonName(lastName)}`;
}

export function parsePaidMembersImport(raw: string): ParsedMemberRow[] {
  const rows: ParsedMemberRow[] = [];
  const seen = new Set<string>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const lower = trimmed.toLowerCase();
    if (["prenom", "prénom", "nom", "first_name", "last_name", "name"].includes(lower)) {
      continue;
    }

    let firstName = "";
    let lastName = "";

    if (trimmed.includes(";") || trimmed.includes("\t") || trimmed.includes(",")) {
      const parts = trimmed.split(/[;\t,]/).map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      }
    } else {
      const parts = trimmed.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        firstName = parts[0];
        lastName = parts.slice(1).join(" ");
      }
    }

    if (!firstName || !lastName) {
      continue;
    }

    const normalizedKey = memberKey(firstName, lastName);
    if (seen.has(normalizedKey)) {
      continue;
    }
    seen.add(normalizedKey);
    rows.push({ firstName, lastName, normalizedKey });
  }

  return rows;
}

export function matchesPaidMember(
  firstName: string,
  lastName: string,
  members: { normalizedKey: string }[],
) {
  const key = memberKey(firstName, lastName);
  return members.some((member) => member.normalizedKey === key);
}
