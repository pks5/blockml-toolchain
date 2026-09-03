import { MODEL_TRANSFORMATION_FQN, TEXT_TYPE_FQN, } from "./constants.js";
import { getPropertyLiteral, setResult } from "./properties.js";
import { lookupReferencedProperty, propertyLiteral, propertyTypeFqn, } from "./property-reference.js";
export { parsePropertyReference } from "./property-reference.js";
export class ResultResolutionError extends Error {
    constructor(message) {
        super(message);
        this.name = "ResultResolutionError";
    }
}
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
    const lookedUp = lookupReferencedProperty(raw, registry, "resultSource");
    if ("error" in lookedUp) {
        throw new ResultResolutionError(lookedUp.error);
    }
    const resultTypeFqn = resolveResultTypeFqn(transformation);
    const sourceTypeFqn = propertyTypeFqn(lookedUp.property);
    if (sourceTypeFqn !== resultTypeFqn) {
        throw new ResultResolutionError(`resultSource property type ${sourceTypeFqn ?? "(unknown)"} does not match result type ${resultTypeFqn}`);
    }
    const value = propertyLiteral(lookedUp.property);
    if (value === undefined) {
        throw new ResultResolutionError(`resultSource property ${lookedUp.blockFqn}.properties.${lookedUp.propertyName} has no value`);
    }
    setResult(transformation, resultTypeFqn, value);
}
//# sourceMappingURL=result.js.map