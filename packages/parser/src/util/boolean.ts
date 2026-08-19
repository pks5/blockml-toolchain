export function normalizeBooleanValue(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (v === "true") {
    return true;
  }
  if (v === "false") {
    return false;
  }
  throw new Error(`Invalid boolean literal: ${raw}`);
}

export function isBooleanLiteral(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "false";
}

export function parseBooleanAttribute(raw: string): boolean {
  return normalizeBooleanValue(raw);
}
