import type { BomDocument, Diagnostic, SerializeOptions, SerializeResult } from "@blockml/bom";
import { createEmitContext } from "./emit/context.js";
import { emitBlockDefinition, emitRootStartTag } from "./emit/block.js";
import { fqnToQName } from "./emit/qname.js";
import { XmlWriter } from "./emit/xml.js";

function authoredDocumentRootTag(
  typeFqn: string | undefined,
  bindings: Record<string, string>,
  rootForm: "block" | "type" | undefined,
): string {
  if (rootForm !== "type" || !typeFqn) {
    return "block";
  }
  const qname = fqnToQName(typeFqn, bindings);
  if (qname.includes(":")) {
    return qname;
  }
  const lastDot = typeFqn.lastIndexOf(".");
  return lastDot === -1 ? typeFqn : typeFqn.slice(lastDot + 1);
}

export function serialize(
  document: BomDocument,
  options: SerializeOptions = {},
): SerializeResult {
  const indent = options.indent ?? 2;
  const bindings = document.source.namespaceBindings ?? { "": "http://blockml.org/bml" };
  const ctx = createEmitContext(bindings, indent);
  const writer = new XmlWriter(indent);
  const diagnostics: Diagnostic[] = [];
  const rootForm = document.source.rootForm;
  const rootTag = authoredDocumentRootTag(document.block.type, bindings, rootForm);

  if (options.xmlDeclaration) {
    writer.line('<?xml version="1.0" encoding="UTF-8"?>');
  }

  writer.comments(document.block.xmlTrivia);
  emitRootStartTag(
    writer,
    bindings,
    document.source.schemaLocation,
    document.source.noNamespaceSchemaLocation,
    document.block.unknownAttributes,
    rootTag,
  );
  writer.pushDepth();
  writer.blank();
  emitBlockDefinition(writer, document.block, ctx, rootForm === "type", rootForm === "type");
  writer.popDepth();
  writer.line(`</${rootTag}>`);

  return {
    text: writer.toString(),
    diagnostics,
    success: true,
  };
}
