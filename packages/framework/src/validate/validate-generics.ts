import type {
  BlockDefinition,
  BlockInstance,
  BomDocument,
  CompositionNode,
  CompositionTemplate,
  Diagnostic,
  GenericsBinding,
  MemberDefinition,
  SourceLocation,
} from "@blockml/bom";
import type { TypeRegistry } from "../registry/type-registry.js";
import {
  openGenericParameters,
  resolveGenericApplication,
} from "../resolve/resolve-generic-application.js";

function diag(
  code: string,
  message: string,
  file: string,
  loc?: SourceLocation,
): Diagnostic {
  return {
    severity: "error",
    code,
    message,
    source: {
      file: loc?.file ?? file,
      line: loc?.line ?? 1,
      column: loc?.column ?? 1,
      ...(loc?.endLine !== undefined ? { endLine: loc.endLine } : {}),
      ...(loc?.endColumn !== undefined ? { endColumn: loc.endColumn } : {}),
    },
  };
}

function reportNotAllowed(
  binding: GenericsBinding,
  file: string,
  diagnostics: Diagnostic[],
): void {
  diagnostics.push(
    diag(
      "BML_GENERICS_DIRECTIVE_NOT_ALLOWED",
      "bml:generics is only allowed on Block instances",
      file,
      binding.source,
    ),
  );
}

function validateInstanceGenerics(
  instance: BlockInstance,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  const typeDoc = registry.get(instance.typeFqn);
  const params = typeDoc?.block.genericTypes ?? [];
  const typeBindings = typeDoc?.source.namespaceBindings ?? {};
  const open = openGenericParameters(params, typeBindings);
  const binding = instance.generics;

  if (!binding) {
    if (open.length > 0) {
      diagnostics.push(
        diag(
          "BML_OPEN_GENERIC_INSTANCE",
          `Instance of ${instance.typeFqn} has open genericTypes and requires bml:generics`,
          file,
          instance.source,
        ),
      );
    }
    return;
  }

  if (open.length === 0) {
    diagnostics.push(
      diag(
        "BML_GENERICS_ARGUMENT_MISMATCH",
        `bml:generics is not applicable; ${instance.typeFqn} has no open genericTypes`,
        file,
        binding.source,
      ),
    );
    return;
  }

  if (binding.arguments === undefined) {
    const raw = binding.raw.trim();
    if (raw.startsWith("(") && raw.endsWith(")")) {
      return;
    }
    diagnostics.push(
      diag(
        "BML_GENERICS_ARGUMENT_MISMATCH",
        "bml:generics must be a parenthesized TypeExpression list",
        file,
        binding.source,
      ),
    );
    return;
  }

  const resolved = resolveGenericApplication(
    params,
    binding.arguments,
    registry,
    typeBindings,
  );
  for (const item of resolved.diagnostics) {
    diagnostics.push(diag(item.code, item.message, file, binding.source));
  }
}

function walkCompositionNodes(
  nodes: CompositionNode[],
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  for (const node of nodes) {
    if (node.kind === "virtualContainer") {
      if (node.generics) {
        reportNotAllowed(node.generics, file, diagnostics);
      }
      walkCompositionNodes(node.children, registry, file, diagnostics);
      continue;
    }
    validateInstanceGenerics(node.instance, registry, file, diagnostics);
    for (const agg of node.instance.aggregationCompositions ?? []) {
      walkCompositionTemplate(agg.composition, registry, file, diagnostics, true);
    }
  }
}

function walkCompositionTemplate(
  template: CompositionTemplate,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
  wrapperIsIllegalHost: boolean,
): void {
  if (wrapperIsIllegalHost && template.generics) {
    reportNotAllowed(template.generics, file, diagnostics);
  }
  walkCompositionNodes(template.children, registry, file, diagnostics);
}

function walkConstraintInstance(
  instance: BlockInstance,
  file: string,
  diagnostics: Diagnostic[],
): void {
  if (instance.generics) {
    reportNotAllowed(instance.generics, file, diagnostics);
  }
}

function walkMember(
  member: MemberDefinition,
  file: string,
  diagnostics: Diagnostic[],
): void {
  if (member.generics) {
    reportNotAllowed(member.generics, file, diagnostics);
  }
  for (const instance of member.constraints ?? []) {
    walkConstraintInstance(instance, file, diagnostics);
  }
  if (member.kind === "property") {
    for (const instance of member.suggestions ?? []) {
      walkConstraintInstance(instance, file, diagnostics);
    }
  }
}

function walkBlock(
  block: BlockDefinition,
  registry: TypeRegistry,
  file: string,
  diagnostics: Diagnostic[],
): void {
  if (block.generics) {
    reportNotAllowed(block.generics, file, diagnostics);
  }
  for (const member of block.members) {
    walkMember(member, file, diagnostics);
  }
  for (const template of block.compositions) {
    walkCompositionTemplate(template, registry, file, diagnostics, true);
  }
  for (const instance of block.constraints ?? []) {
    walkConstraintInstance(instance, file, diagnostics);
  }
  for (const sub of block.subBlocks) {
    walkBlock(sub, registry, file, diagnostics);
  }
  for (const embedded of block.embeddedBlocks) {
    walkBlock(embedded, registry, file, diagnostics);
  }
}

export function validateGenerics(
  document: BomDocument,
  registry: TypeRegistry,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const file = document.source.filePath ?? "<memory>";
  walkBlock(document.block, registry, file, diagnostics);
  return diagnostics;
}
