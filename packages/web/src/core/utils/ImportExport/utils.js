// Shared helpers for Import/Export modules
// normalizeKeyPart: NFKC + trim + collapse spaces + lowercase

export function normalizeKeyPart(str) {
  return String(str ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export default { normalizeKeyPart };
