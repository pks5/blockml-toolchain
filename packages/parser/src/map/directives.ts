import type {
  DirectiveAttribute,
  EachDirective,
  ExpressionValue,
  GenericsBinding,
  IfDirective,
  UnlessDirective,
  WithBinding,
  WithDirective,
} from "@blockml/bom";
import type { Element } from "@xmldom/xmldom";
import {
  containsUnescapedInterpolation,
  expressionFromRaw,
  unescapeInterpolationDelimiters,
} from "./member-value.js";
import {
  elementChildren,
  elementLocalName,
  elementPrefix,
  getAttribute,
  getCharacterData,
} from "../util/xml.js";
import type { SourceLocation } from "@blockml/bom";
import type { MapContext } from "./context.js";
import { collectUnknownBmlAttributes, reportDiagnostic } from "./structural.js";
import {
  parseGenericArgumentList,
  type TypeExpressionResolveOptions,
} from "./type-expression.js";
import { attributeValueLoc, elementSourceLoc } from "../util/qname.js";

const BML_NS = "http://blockml.org/bml";

function splitBindingList(input: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quote) {
      if (ch === "\\" && i + 1 < input.length) {
        i++;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (ch === "$" && input[i + 1] === "{") {
      brace++;
      i++;
      continue;
    }
    if (ch === "(") {
      paren++;
      continue;
    }
    if (ch === ")") {
      if (paren > 0) {
        paren--;
      }
      continue;
    }
    if (ch === "[") {
      bracket++;
      continue;
    }
    if (ch === "]") {
      if (bracket > 0) {
        bracket--;
      }
      continue;
    }
    if (ch === "{") {
      brace++;
      continue;
    }
    if (ch === "}") {
      if (brace > 0) {
        brace--;
      }
      continue;
    }
    if (ch === "," && paren === 0 && bracket === 0 && brace === 0) {
      parts.push(input.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(input.slice(start));
  return parts;
}

function bmlAttr(element: Element, local: string): string | undefined {
  return (
    getAttribute(element, `bml:${local}`) ??
    getAttribute(element, `${BML_NS}:${local}`)
  );
}

export const isGenericsDirectiveElement = (element: Element): boolean => {
  const local = elementLocalName(element);
  const prefix = elementPrefix(element);
  return (prefix === "bml" && local === "generics") || local === "bml:generics";
};

export function parseGenericsBinding(
  element: Element,
  ctx: MapContext,
  options?: TypeExpressionResolveOptions,
): GenericsBinding | undefined {
  const loc = elementSourceLoc(ctx.filePath, ctx.source, element);
  const attr = bmlAttr(element, "generics");
  const child = elementChildren(element).find(isGenericsDirectiveElement);

  let raw: string | undefined;
  let authoredPlacement: "attribute" | "element";
  let source = loc;

  if (attr !== undefined) {
    raw = attr;
    authoredPlacement = "attribute";
    source =
      attributeValueLoc(ctx.filePath, ctx.source, element, "bml:generics", attr) ?? loc;
  } else if (child) {
    raw = getCharacterData(child).text;
    authoredPlacement = "element";
    source = elementSourceLoc(ctx.filePath, ctx.source, child);
  } else {
    return undefined;
  }

  const binding: GenericsBinding = {
    raw,
    authoredPlacement,
    source,
  };

  const parsed = parseGenericArgumentList(raw, ctx.bindings, "type", options);
  if (parsed.ok) {
    binding.arguments = parsed.arguments;
  } else if (parsed.code === "BML_INVALID_TYPE_REFERENCE") {
    reportDiagnostic(ctx, parsed.code, parsed.message, source);
  }

  return binding;
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
    const bindings: WithBinding[] = splitBindingList(withAttr).map((part) => {
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
  const trimmed = raw.trim();
  const looksLikeJson = trimmed.startsWith("[") || trimmed.startsWith("{");
  if (!looksLikeJson && containsUnescapedInterpolation(raw)) {
    return {
      kind: "interpolated" as const,
      raw,
      source: loc,
    };
  }
  return {
    kind: "literal" as const,
    value: unescapeInterpolationDelimiters(raw),
    typeFqn,
  };
}
