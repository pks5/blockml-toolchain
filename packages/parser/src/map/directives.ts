import type {
  DirectiveAttribute,
  EachDirective,
  ExpressionValue,
  IfDirective,
  UnlessDirective,
  WithBinding,
  WithDirective,
} from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import { expressionFromRaw } from "./member-value.js";
import { getAttribute } from "../util/xml.js";
import type { SourceLocation } from "@blockml/bom";
import type { MapContext } from "./context.js";
import { collectUnknownBmlAttributes } from "./structural.js";

const BML_NS = "http://blockml.org/bml";

function bmlAttr(element: Element, local: string): string | undefined {
  return (
    getAttribute(element, `bml:${local}`) ??
    getAttribute(element, `${BML_NS}:${local}`)
  );
}

export function parseDirectives(
  element: Element,
  loc: SourceLocation,
  ctx?: MapContext,
): DirectiveAttribute[] {
  const directives: DirectiveAttribute[] = [];

  if (ctx) {
    collectUnknownBmlAttributes(element, ctx);
  }

  const each = bmlAttr(element, "each");
  if (each !== undefined) {
    const colon = each.indexOf(":");
    let variables: string[] = [];
    let collectionRaw = each;
    if (colon !== -1) {
      variables = each
        .slice(0, colon)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      collectionRaw = each.slice(colon + 1).trim();
    }
    let collection: ExpressionValue;
    if (collectionRaw.startsWith("${")) {
      collection = expressionFromRaw(collectionRaw, loc);
    } else {
      collection = expressionFromRaw(`\${ ${collectionRaw} }`, loc);
    }
    directives.push({
      type: "each",
      variables,
      collection,
    } satisfies EachDirective);
  }

  const ifAttr = bmlAttr(element, "if");
  if (ifAttr !== undefined) {
    directives.push({
      type: "if",
      condition: expressionFromRaw(ifAttr, loc),
    } satisfies IfDirective);
  }

  const unless = bmlAttr(element, "unless");
  if (unless !== undefined) {
    directives.push({
      type: "unless",
      condition: expressionFromRaw(unless, loc),
    } satisfies UnlessDirective);
  }

  const withAttr = bmlAttr(element, "with");
  if (withAttr !== undefined) {
    const bindings: WithBinding[] = withAttr.split(",").map((part) => {
      const eq = part.indexOf("=");
      const name = (eq === -1 ? part : part.slice(0, eq)).trim();
      const valueRaw = eq === -1 ? "" : part.slice(eq + 1).trim();
      return {
        name,
        value: expressionFromRaw(valueRaw, loc),
      };
    });
    directives.push({ type: "with", bindings } satisfies WithDirective);
  }

  return directives;
}

export function parseBmlMeta(
  element: Element,
  typeFqn: string,
  file: string,
  loc: SourceLocation,
) {
  const id = bmlAttr(element, "id");
  const version = bmlAttr(element, "version");
  const bean = bmlAttr(element, "bean");
  const scope = bmlAttr(element, "scope") as "local" | "context" | undefined;

  return {
    id: id !== undefined ? parseMetaValue(id, typeFqn, file, loc) : undefined,
    version:
      version !== undefined
        ? parseMetaValue(version, typeFqn, file, loc)
        : undefined,
    bean:
      bean !== undefined ? parseMetaValue(bean, typeFqn, file, loc) : undefined,
    scope,
  };
}

function parseMetaValue(
  raw: string,
  typeFqn: string,
  file: string,
  loc: SourceLocation,
) {
  if (raw.startsWith("${") && raw.endsWith("}")) {
    return expressionFromRaw(raw, loc);
  }
  return {
    kind: "literal" as const,
    value: raw,
    typeFqn,
  };
}
