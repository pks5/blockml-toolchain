export type Visibility = "private" | "protected" | "public";

export function parseVisibilityFromName(localName: string): {
  name: string;
  visibility: Visibility;
} {
  if (localName.startsWith("__")) {
    return { name: localName.slice(2), visibility: "private" };
  }
  if (localName.startsWith("_")) {
    return { name: localName.slice(1), visibility: "protected" };
  }
  return { name: localName, visibility: "public" };
}

export function visibilityPrefix(visibility: Visibility | undefined): string {
  switch (visibility) {
    case "private":
      return "__";
    case "protected":
      return "_";
    default:
      return "";
  }
}
