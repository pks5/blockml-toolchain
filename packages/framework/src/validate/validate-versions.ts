import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  Diagnostic,
  MemberValue,
} from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
import { findOwningLibraryDocument } from "../registry/library-membership.js";

function diag(
  code: string,
  message: string,
  file: string,
  line = 1,
  column = 1,
): Diagnostic {
  return { severity: "error", code, message, source: { file, line, column } };
}

function requiresExplicitVersion(
  block: BlockDefinition,
  registry: TypeRegistry,
  file: string,
): boolean {
  if (!block.type || block.version) {
    return false;
  }
  const owning = findOwningLibraryDocument(registry, block.type, file);
  if (owning?.block.version) {
    return false;
  }
  return true;
}

function literalString(val: MemberValue | undefined): string | undefined {
  if (!val || val.kind !== "literal") {
    return undefined;
  }
  return String(val.value);
}

function checkVersionPin(
  instance: BlockInstance,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  const pin = literalString(instance.version);
  if (!pin) {
    return;
  }
  const doc = registry.get(instance.typeFqn);
  if (!doc) {
    diagnostics.push(
      diag(
        "BML_UNKNOWN_VERSION",
        `Unknown type for version pin: ${instance.typeFqn}@${pin}`,
        file,
        instance.source?.line,
        instance.source?.column,
      ),
    );
    return;
  }
  if (doc.block.version && doc.block.version !== pin) {
    diagnostics.push(
      diag(
        "BML_UNKNOWN_VERSION",
        `Version pin ${pin} does not match ${instance.typeFqn} (${doc.block.version})`,
        file,
        instance.source?.line,
        instance.source?.column,
      ),
    );
  }
}

function walkCompositionInstances(
  block: BlockDefinition,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  for (const template of block.compositions) {
    const walkNodes = (nodes: typeof template.children) => {
      for (const node of nodes) {
        if (node.kind === "blockInstance") {
          checkVersionPin(node.instance, registry, file, diagnostics);
        } else {
          walkNodes(node.children);
        }
      }
    };
    walkNodes(template.children);
  }
}

function validateBlockVersions(
  block: BlockDefinition,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
  isDocumentRoot: boolean,
): void {
  if (isDocumentRoot && requiresExplicitVersion(block, registry, file)) {
    diagnostics.push(
      diag(
        "BML_MISSING_VERSION",
        `Missing version on block ${block.type}`,
        file,
        block.source?.line,
        block.source?.column,
      ),
    );
  }

  walkCompositionInstances(block, registry, file, diagnostics);

  for (const sub of block.subBlocks) {
    validateBlockVersions(sub, registry, file, diagnostics, false);
  }
}

export function validateVersions(
  document: BomDocument,
  registry: TypeRegistry,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const file = document.source.filePath ?? "<memory>";

  if (document.block.type && !registry.has(document.block.type)) {
    registry.register(document);
  }

  validateBlockVersions(document.block, registry, file, diagnostics, true);
  return diagnostics;
}
