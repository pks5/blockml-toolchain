import { parse } from "@blockml/parser";
import { bomLocationToRange } from "./positions.js";
export const SymbolKind = {
    Class: 5,
    Method: 6,
    Property: 7,
    Field: 8,
};
function memberTypeFqn(member) {
    switch (member.kind) {
        case "property":
        case "capability":
            return member.typeFqn || undefined;
        case "association":
            return member.type.kind === "named" ? member.type.fqn : undefined;
        case "aggregation":
            return member.type?.kind === "named" ? member.type.fqn : undefined;
    }
}
function memberKind(member) {
    switch (member.kind) {
        case "property":
            return SymbolKind.Property;
        case "capability":
            return SymbolKind.Method;
        case "aggregation":
        case "association":
            return SymbolKind.Field;
    }
}
function memberDetail(member) {
    const typeFqn = memberTypeFqn(member);
    return typeFqn ? `${member.kind} ${typeFqn}` : member.kind;
}
function blockSymbol(block, text) {
    if (!block.source) {
        return undefined;
    }
    const range = bomLocationToRange(block.source, text);
    const children = [];
    for (const member of block.members) {
        if (!member.source) {
            continue;
        }
        const memberRange = bomLocationToRange(member.source, text);
        const symbol = {
            name: member.name,
            detail: memberDetail(member),
            kind: memberKind(member),
            range: memberRange,
            selectionRange: memberRange,
        };
        children.push(symbol);
    }
    for (const sub of block.subBlocks) {
        const child = blockSymbol(sub, text);
        if (child) {
            children.push(child);
        }
    }
    for (const embedded of block.embeddedBlocks) {
        const child = blockSymbol(embedded, text);
        if (child) {
            children.push(child);
        }
    }
    const result = {
        name: block.name,
        detail: block.type,
        kind: SymbolKind.Class,
        range,
        selectionRange: range,
    };
    if (children.length > 0) {
        result.children = children;
    }
    return result;
}
export function documentSymbols(text, filePath) {
    const parseResult = parse(text, { filePath, continueOnError: true });
    if (!parseResult.document) {
        return null;
    }
    const root = blockSymbol(parseResult.document.block, text);
    return root ? [root] : [];
}
//# sourceMappingURL=outline.js.map