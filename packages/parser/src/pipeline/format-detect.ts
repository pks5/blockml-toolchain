export function detectFormat(source: string): "xml" | null {
  const trimmed = source.trimStart();
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) {
    return "xml";
  }
  return null;
}
