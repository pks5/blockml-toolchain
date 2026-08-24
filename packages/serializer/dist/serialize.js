import { createEmitContext } from "./emit/context.js";
import { emitBlockDefinition, emitRootStartTag } from "./emit/block.js";
import { XmlWriter } from "./emit/xml.js";
export function serialize(document, options = {}) {
    const indent = options.indent ?? 2;
    const bindings = document.source.namespaceBindings ?? { "": "http://blockml.org/bml" };
    const ctx = createEmitContext(bindings, indent);
    const writer = new XmlWriter(indent);
    const diagnostics = [];
    if (options.xmlDeclaration) {
        writer.line('<?xml version="1.0" encoding="UTF-8"?>');
    }
    writer.comments(document.block.xmlTrivia);
    emitRootStartTag(writer, bindings, document.source.schemaLocation, document.source.noNamespaceSchemaLocation, document.block.unknownAttributes);
    writer.pushDepth();
    writer.blank();
    emitBlockDefinition(writer, document.block, ctx);
    writer.popDepth();
    writer.line("</block>");
    return {
        text: writer.toString(),
        diagnostics,
        success: true,
    };
}
//# sourceMappingURL=serialize.js.map