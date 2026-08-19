import type { Element } from "@xmldom/xmldom";
import { elementLocalName } from "../util/xml.js";

export function assertBlockRoot(element: Element): void {
  const local = elementLocalName(element);
  if (local !== "block") {
    throw new Error(`BML_INVALID_ROOT: expected <block>, got <${local}>`);
  }
}
