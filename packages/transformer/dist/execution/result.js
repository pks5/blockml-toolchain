import { resolveEffectiveMembers } from "@blockml/framework";
import { MODEL_TRANSFORMATION_FQN, TEXT_TYPE_FQN, } from "./constants.js";
import { getPropertyLiteral, setResult } from "./properties.js";
export class ResultResolutionError extends Error {
    constructor(message) {
        super(message);
        this.name = "ResultResolutionError";
    }
}
const PROPERTIES_SEGMENT = ".properties.";
export function resolveResultTypeFqn(block) {
    const fromExpression = resultArgumentFqn(block.baseTypeExpression);
    if (fromExpression) {
        return fromExpression;
    }
    return TEXT_TYPE_FQN;
}
function resultArgumentFqn(expr) {
    if (expr?.kind !== "named" || expr.fqn !== MODEL_TRANSFORMATION_FQN) {
        return undefined;
    }
    const arg = expr.typeArguments?.[1];
    return arg?.kind === "named" ? arg.fqn : undefined;
}
export function parsePropertyReference(raw) {
    const index = raw.lastIndexOf(PROPERTIES_SEGMENT);
    if (index <= 0) {
        return undefined;
    }
    const blockFqn = raw.slice(0, index);
    const propertyName = raw.slice(index + PROPERTIES_SEGMENT.length);
    if (!blockFqn || !propertyName || propertyName.includes(".")) {
        return undefined;
    }
    return { blockFqn, propertyName };
}
function propertyTypeFqn(property) {
    if (property.typeFqn) {
        return property.typeFqn;
    }
    if (property.type?.kind === "named") {
        return property.type.fqn;
    }
    return undefined;
}
function propertyLiteral(property) {
    const value = property.value ?? property.values?.[0]?.value;
    if (value?.kind === "literal") {
        return value.value;
    }
    return undefined;
}
/**
 * Copy resultSource onto result. No-op when resultSource is unset.
 * Throws ResultResolutionError when the path, Block, Property, type, or value is invalid.
 */
export function applyTransformationResult(transformation, registry) {
    const raw = getPropertyLiteral(transformation, "resultSource");
    if (raw === undefined || raw === "") {
        return;
    }
    if (typeof raw !== "string") {
        throw new ResultResolutionError("resultSource must be a PropertyReference path");
    }
    const parsed = parsePropertyReference(raw);
    if (!parsed) {
        throw new ResultResolutionError(`resultSource "${raw}" is not a valid PropertyReference (expected BlockFqn.properties.name)`);
    }
    const target = registry.get(parsed.blockFqn);
    if (!target) {
        throw new ResultResolutionError(`resultSource block ${parsed.blockFqn} was not found`);
    }
    const property = resolveEffectiveMembers(target.block, registry).find((member) => member.kind === "property" && member.name === parsed.propertyName);
    if (!property) {
        throw new ResultResolutionError(`resultSource property ${parsed.propertyName} was not found on ${parsed.blockFqn}`);
    }
    const resultTypeFqn = resolveResultTypeFqn(transformation);
    const sourceTypeFqn = propertyTypeFqn(property);
    if (sourceTypeFqn !== resultTypeFqn) {
        throw new ResultResolutionError(`resultSource property type ${sourceTypeFqn ?? "(unknown)"} does not match result type ${resultTypeFqn}`);
    }
    const value = propertyLiteral(property);
    if (value === undefined) {
        throw new ResultResolutionError(`resultSource property ${parsed.blockFqn}.properties.${parsed.propertyName} has no value`);
    }
    setResult(transformation, resultTypeFqn, value);
}
//# sourceMappingURL=result.js.map