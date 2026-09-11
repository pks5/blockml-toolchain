import type { BlockInstanceNode, SourceLocation, TypeExpression } from "@blockml/bom";
import type { MapContext } from "./context.js";
import { parseMemberValue } from "./member-value.js";

export const META_KEYWORD = "org.blockml.bml.meta.Keyword";
export const META_ALIAS = "org.blockml.bml.meta.Alias";

const TYPE = "org.blockml.bml.type";

/** Concrete PrimitiveEntity payloads that use comma-separated value sugar. */
const WELL_KNOWN_COMMA_SUGAR_PAYLOADS = new Set<string>([
  META_KEYWORD,
  META_ALIAS,
  `${TYPE}.AggregationIdentifierEntity`,
  `${TYPE}.AssociationIdentifierEntity`,
  `${TYPE}.BooleanEntity`,
  `${TYPE}.CapabilityIdentifierEntity`,
  `${TYPE}.ColorEntity`,
  `${TYPE}.DateEntity`,
  `${TYPE}.DateTimeEntity`,
  `${TYPE}.DecimalEntity`,
  `${TYPE}.DurationEntity`,
  `${TYPE}.FilePathEntity`,
  `${TYPE}.FloatEntity`,
  `${TYPE}.InstanceIdentifierEntity`,
  `${TYPE}.IntegerEntity`,
  `${TYPE}.MemberIdentifierEntity`,
  `${TYPE}.MimeTypeEntity`,
  `${TYPE}.PackageIdentifierEntity`,
  `${TYPE}.PackageSelectorEntity`,
  `${TYPE}.PropertyIdentifierEntity`,
  `${TYPE}.TextEntity`,
  `${TYPE}.TimeEntity`,
  `${TYPE}.TypeIdentifierEntity`,
  `${TYPE}.TypeSelectorEntity`,
  `${TYPE}.URIEntity`,
  `${TYPE}.URLEntity`,
  `${TYPE}.UUIDEntity`,
  `${TYPE}.VersionEntity`,
]);

function commaSeparatedTokens(text: string): string[] {
  return text
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function namedTypePayloadFqn(expr: TypeExpression | undefined): string | undefined {
  if (!expr) {
    return undefined;
  }
  if (expr.kind === "named") {
    return expr.fqn;
  }
  if (expr.kind === "grouped") {
    return namedTypePayloadFqn(expr.expression);
  }
  return undefined;
}

function isCommaSugarPayload(fqn: string, ctx?: MapContext): boolean {
  if (WELL_KNOWN_COMMA_SUGAR_PAYLOADS.has(fqn)) {
    return true;
  }
  return ctx?.isCommaSugarPayload?.(fqn) === true;
}

function expandPrimitiveEntityValueSugar(
  payloadFqn: string,
  text: string,
): { typeFqn: string; value: string }[] {
  return commaSeparatedTokens(text).map((value) => ({ typeFqn: payloadFqn, value }));
}

function primitiveEntitySugarNodes(
  payloadFqn: string,
  text: string,
  ctx: MapContext,
  source?: SourceLocation,
): BlockInstanceNode[] {
  const loc = source ?? { file: ctx.filePath, line: 1, column: 1 };
  return expandPrimitiveEntityValueSugar(payloadFqn, text).map((entry) => {
    const value = parseMemberValue(
      entry.value,
      payloadFqn,
      loc.file,
      loc.line,
      loc.column,
      "attribute",
      ctx,
    );
    return {
      kind: "blockInstance" as const,
      instance: {
        typeFqn: entry.typeFqn,
        memberValues: value ? { value } : {},
      },
      ...(source ? { source } : {}),
    };
  });
}

export {
  expandPrimitiveEntityValueSugar,
  isCommaSugarPayload,
  namedTypePayloadFqn,
  primitiveEntitySugarNodes,
};
