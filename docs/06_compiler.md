# BOM Compiler — Compiler Pipeline

version: 2.0.0

## Purpose of this Document

This document defines the compiler pipeline — the full translation path from BML source to render target output — including the Target Registry, error handling, diagnostics, and the testing strategy.

For the BML format see `02_mbml.md`.
For the BML→BOM mapping algorithm see `13_bml_to_bom_mapping.md`.
For compiler runtime (compile I/O model, NativeBlock model) see `14_compiler_runtime.md`.
For the formal BOM object model see `12_bom_object_model.md`.
For the MBOM object model see `03_mbom.md`.
For the SCAD Renderer see `05_scad_renderer.md`.

---

## Overview

The compiler is implemented across these packages:

```text
@blockml/parser                              — parse BML → BOM
@blockml/core                                — BOM object model, validation, framework + built-in service BML
@blockml/compiler                            — Facade + Target Registry
@blockml/engine-maker                        — V1 CompilerEngine implementation (MakerEngine)
@machineblocks/machineblocks-v3-scad-target  — RenderTarget + BlockProcessors
```

`@blockml/parser`, `@blockml/core`, `@blockml/compiler`, and `@blockml/engine-maker` are browser and Node compatible. No Node-only APIs in any of these packages. RenderTarget packages follow the same constraint.

---

## Compiler Pipeline

> **Architecture decision:** Parser produces immutable Canonical BOM. Framework utilities and renderer pipelines are separate layers. See `00_bom_core.md` — Fundamental Architecture Principles.

## Validation Pipeline

> **Architecture decision:** Three independent validation stages. See `00_bom_core.md` — Validation pipeline.

```text
Stage 1 — XML (Parser)
  Checks: XML syntax · namespaces · XSD
  No semantics.

Stage 2 — Validator
  Creates immutable Canonical BOM + mutable default Working Model.
  Checks: inheritance · contracts · type compatibility · visibility ·
          constraints · references · expression correctness
  Expressions are NOT evaluated.

Stage 3 — Renderer / Runtime
  Decides: expression evaluation · optional handling · capability interpretation ·
           code generation · runtime behaviour
```

### Layer 1 — Parser (`@blockml/parser`) — Stage 1

Produces the **Canonical BOM**. No semantic decisions. Output is immutable.

```text
BML Source (.bml)                   — V1: XML only; JSON BML deferred (TBD)
  ↓
[1] Format Detector
  ↓
[2] XML Parser
  ↓
[3] Root Type Resolver
  ↓
[4] Namespace Resolver
  ↓
[5] BML → BOM Mapper
  ↓
Canonical BOM (immutable)
```

### Layer 2 — Validator / Framework Utilities (`@blockml/core`) — Stage 2

Optional, composable functions. **Never mutate** the Canonical BOM. Return derived views, diagnostics, or new structures.

```text
resolveInheritance(bom, registry)       → EffectiveMemberSet
resolveEffectiveMembers(block, registry)  → EffectiveMemberSet
resolveType(typeFqn, registry)          → TypeDescriptor
resolveReference(ref, bom, registry)    → ResolvedReference
resolveContracts(block, registry)       → EffectiveMemberSet  (contract merge slice; used by resolveEffectiveMembers)
resolveGenerics(typeExpr, registry)     → ResolvedTypeExpr
parseExpression(raw, context)           → ExpressionNode + resultTypeFqn
evaluateExpression(ast, context)        → evaluated value (working model)
expandComposition(bom, context)       → ExpandedComposition
expandDirectives(bom, context)          → ExpandedComposition
validateTypes(bom, registry)            → Diagnostic[]
validateConstraints(bom, registry)      → Diagnostic[]
```

The CLI may invoke utilities before or during compile for diagnostics — but utilities **never write back** to the Canonical BOM.

### Layer 3 — Renderer Pipeline (target-specific) — Stage 3

Each renderer defines its own flow. Example — **SCAD Renderer** (reference implementation):

```text
Canonical BOM (immutable)
  ↓
[9]  Target Resolver
  ↓
[10] expandDirectives()          — utility → ExpandedComposition (working model)
  ↓
[11] Module Name Resolver
  ↓
[12] Import Resolver
  ↓
[13] resolveEffectiveMembers() + Property merge  — utility → resolved values (working model)
  ↓
[14] evaluateExpression() / Expression emit
  ↓
[15] Assembly Pattern Mapper
  ↓
[16] Composition Renderer
  ↓
[17] Set Renderer
  ↓
[18] Customizer Generator
  ↓
[19] Source Map Generator
  ↓
Target Output File(s) + Source Map(s)
```

Example — **Documentation Renderer**:

```text
Canonical BOM (immutable)  →  renderRawBOM()  →  Markdown / HTML
```

Stages [9]–[19] are **not** a fixed framework pipeline — they document the SCAD reference renderer. Other renderers choose different utilities and ordering.

---

## Pipeline Stages

### [1] Format Detector

V1 accepts **XML only** (`.bml`). Detects XML from the first non-whitespace character (`<`).

JSON BML authoring is deferred (TBD). When implemented, the format detector will branch on `{` vs. `<`.

### [2] XML Parser

Parses the raw XML source into an intermediate document tree. Browser-compatible parsers only.

JSON parser: **not in V1.**

### [3] Root Type Resolver

Reads the root element name to determine the document type:

```text
<block>   → Block Definition (all block types)
```

V1 has a single root element. Preset blocks use `<block baseType="com.machineblocks.bml.core.Block">` with `_presets` composition.

Selects the appropriate BML→BOM mapping rule for this root type. Extension root types register their mapping rule via the root type registry.

### [4] Namespace Resolver

Resolves all xmlns prefix mappings to FQNs:

```text
xmlns:ac="com.martianmicro.anyclosure"
ac:Wall  →  com.martianmicro.anyclosure.Wall
```

The resolved FQN is used throughout the rest of the pipeline.

### [5] BML → BOM Mapper

Maps the parsed document tree to BOM objects using the mapping rule for the detected root type. Expression `${ }` spans are captured as `ExpressionValue { raw }` only — AST construction is a **`parseExpression()` utility**, not a parser stage. See `13_bml_to_bom_mapping.md`.

```text
XML attribute        →  BOM property value (literal or ExpressionValue { raw })
XML child element    →  BOM composition child instance or aggregation metadata
Member sections      →  members[] in document order (properties → aggregations → associations → capabilities); no sorting
```

Mapping rules are defined once per root type. The mapper produces the **Canonical BOM** — immutable after this stage.

---

## Framework Utilities (formerly stages [6]–[8])

> **`@blockml/core` utilities** — read immutable BOM, return results, **never mutate** Canonical BOM. See `00_bom_core.md` — Framework Utilities.

### validateTypes()

```text
validateTypes(bom, registry) → Diagnostic[]
```

Checks member values conform to declared types **without rewriting** authored values. For MBOM: native property types from `09_mbom_properties.yml`, custom types from block definitions.

### parseExpression()

```text
parseExpression(raw, context) → { ast: ExpressionNode, resultTypeFqn?: string }
```

Parses `${ }` source into AST. **Utility output** — not written into Canonical BOM. BOM stores `ExpressionValue.raw` only.

Recognized forms: property access, attribute access, built-in/bean calls, capability linking, model bindings, ternary, arithmetic. See `10_expression_language.md`.

### validateConstraints()

```text
validateConstraints(bom, registry) → Diagnostic[]
```

Semantic checks: constraint type compatibility, generic binding, validation references, and value enforcement (including `org.blockml.bml.constraint.ValuePresent` after full model resolution). Also: cross-instance references, capability linking, aggregation cardinality, expression type compatibility (via `parseExpression()`). Returns diagnostics only.

The CLI typically calls these after parse. Renderers may call them during their pipeline.

---

## Renderer Pipeline (SCAD reference — stages [9]–[19])

> **Not a fixed framework pipeline.** Each renderer defines its own flow. Stages below document the SCAD reference renderer.

### [9] Target Resolver

Looks up the requested Target by name in the Target Registry. Verifies that the Target supports the `baseType` of every Block in the BOM document. If no registered Target supports a Block's `baseType`, a diagnostic error is emitted for that Block.

For Composite Targets: resolves the responsible Atomic Target per Block and validates accordingly.

### [10] expandDirectives() + ID Resolution

**Renderer working model** — uses `expandDirectives()` utility on a **copy/view** of the BOM. Canonical BOM is unchanged. See `00_bom_core.md` — Canonical BOM is immutable.

Before rendering, the BlockProcessor expands `bml:each`, `bml:if`, and `bml:with` on the composition tree. Then:

```text
1. Evaluate id expressions on expanded instances
2. Assign deterministic auto-IDs to static unreferenced children still lacking id
3. Compose nested paths (parentPartId::childPartId) for render output
```

Auto-IDs are not written back to `BomDocument`.

### [11] Block Renderer Dispatch

Dispatches each Block in the BOM to its Block Renderer within the resolved Target. For Atomic Targets this is a direct lookup. For Composite Targets this iterates across Atomic Targets.

---

## Target Registry

The Target Registry is the central registration point for all RenderTargets. It is part of `@blockml/compiler`. The compiler **does not register any targets by default** — see `14_compiler_runtime.md` — Target Bootstrap (C3).

### Registration

RenderTargets must be registered before compilation reaches stage [9]:

```typescript
import { registerTarget } from "@blockml/compiler";
import { MakerEngine } from "@blockml/engine-maker";
import { MachineBlocksV3ScadTarget } from "@machineblocks/machineblocks-v3-scad-target";

const engine = new MakerEngine();
registerTarget(new MachineBlocksV3ScadTarget(engine));
```

**Who registers:**

```text
@blockml/cli     → bootstrapTargets() before compile/watch (V1: hardcoded SCAD target)
Browser / tests  → caller invokes registerTarget() directly
@blockml/compiler → registerTarget() / getTarget() API only — no built-in targets
```

Future: CLI reads `bom.config.json` → `targets[]` (TBD — not V1). See C3 in `14_compiler_runtime.md`.

### Interfaces

```typescript
interface RenderTarget {
  name:       string
  engine?:    RenderEngine
  processors: BlockProcessor[]
  delegates:  RenderTarget[]
}

interface BlockProcessor {
  baseType: string
  process(block: Block, engine: RenderEngine): RenderOutput
}

interface RenderEngine {
  compile(block: Block, processor: BlockProcessor, context: RenderContext): RenderOutput
  renderTemplate(block: Block, templatePath: string): RenderOutput
  renderTemplates(block: Block, templatePaths: string[]): RenderOutput
  copyTemplate(sourcePath: string, targetPath: string): RenderOutput
  callLLM(block: Block, prompt: string, context: RenderContext): RenderOutput  // future
}
```

### RenderContext

Per-block render state passed to `RenderEngine.compile()`. **Internal API** — not part of the public Facade (C2). Full specification: `14_compiler_runtime.md` — RenderContext (C1).

```typescript
interface RenderSession {
  typeRegistry: TypeRegistry
  sourceFilePath: string
  outputBasePath: string
  targetName: string
  documentKind: BomDocumentKind
  activeConfig?: string
  mbLibPath?: string
}

interface RenderContext {
  session: RenderSession
  blockFqn: string
  outputRelativePath: string
  parentPartId?: string
  partId?: string
  instance?: BlockInstance
  withScope: ReadonlyMap<string, ExpressionValue>
  loopScope?: ReadonlyMap<string, ExpressionValue>
  activePresetId?: string
  child(overrides: Partial<Omit<RenderContext, "session" | "child">>): RenderContext
}
```

`CompileOptions` (session-level) maps into `RenderSession`. Per-node fields are forked via `context.child()` during composition rendering. Property values are resolved on demand via `PropertyResolver` — not cached on context (V1).

### Dispatch Logic

For each Block:

```text
1. Own processors: exact FQN match        (most specific wins)
2. Own processors: baseType-chain fallback
3. Delegates: same logic applied recursively
4. No match → BML_NO_TARGET diagnostic error
```

### Target Example — Mixed Strategies

```typescript
class MachineBlocksV3ScadTarget implements RenderTarget {
  name = "machineblocks-v3-scad"
  engine = new MakerEngine()

  processors = [
    new ScadSetProcessor(),           // compile strategy — more specific
    new ScadBlockProcessor(),         // compile strategy — baseType fallback
    new MathBuiltInProcessor(),       // copy strategy
    new CapabilityImplementationProcessor()      // compile strategy (TS → SCAD)
  ]

  delegates = []
}
```

### Delegate-Only Target Example

```typescript
class MartianMicroAnyclosureTarget implements RenderTarget {
  name = "martianmicro-anyclosure"
  engine = undefined                  // no engine needed
  processors = []                     // no own processors
  delegates = [machineBlocksV3ScadTarget]  // full delegation
}
```

---

## Compiler Facade API

`@blockml/compiler` exposes three public functions. See `14_compiler_runtime.md` — Compiler Facade API (C2) for full specification.

```typescript
interface CompileInput {
  source:   string
  filePath: string
  format?:  "xml"          // V1: xml only
}

interface CompileOptions {
  typeRegistry?:    TypeRegistry
  activeConfig?:    string
  outputBasePath?:  string
  mbLibPath?:       string
}

compileBmlToBom(input: CompileInput, options?: CompileOptions): CompilerResult<BomDocument>
compileBomToOutput(model: BomDocument, targetName: string, options?: CompileOptions): CompilerResult<RenderOutput>
compileBmlToOutput(input: CompileInput, targetName: string, options?: CompileOptions): CompilerResult<RenderOutput>
```

### CompilerResult

```typescript
interface CompilerResult<T> {
  output:       T | null
  diagnostics:  Diagnostic[]
  success:      boolean
}
```

### RenderOutput

`RenderOutput` is defined by the Render Target, not by the compiler. The compiler treats it as opaque — **no assumption of 1:1 input→output or non-empty files**. See `14_compiler_runtime.md` — Compile I/O Model (C4).

```typescript
// SCAD Target (file-based — MachineBlocks convention)
interface ScadRenderOutput {
  files: ScadFile[]                    // may be [] — side-effect-only compile is valid
  sideEffects?: RenderSideEffect[]     // optional — future / other targets
}

interface ScadFile {
  path:      string
  content:   string
  sourceMap?: string
}
```

A target may also return **side effects without files** (service calls, deploy, registry update). `CompilerResult.success === true` with empty `files[]` is valid.

For preset blocks in the MachineBlocks SCAD target, `files[]` includes the implicit block `.scad`, its `.map`, and the Customizer `.json`. Binary artifacts (`.webp`) are produced by `@blockml/cli` after compile — see `14_compiler_runtime.md` — Thumbnails (C6).

### Browser Usage

```typescript
import { compileBmlToOutput, registerTarget } from "@blockml/compiler";
import { MakerEngine } from "@blockml/engine-maker";
import { MachineBlocksV3ScadTarget } from "@machineblocks/machineblocks-v3-scad-target";

registerTarget(new MachineBlocksV3ScadTarget(new MakerEngine()));

const result = compileBmlToOutput(
  { source: xmlSource, filePath: "Wall.bml" },
  "machineblocks-v3-scad",
  { typeRegistry: preloadedRegistry }
);

if (result.success) {
  const scad = (result.output as ScadRenderOutput).files[0].content;
} else {
  result.diagnostics.forEach(d => console.error(d));
}
```

---

## Diagnostics

Every error, warning, and info message produced by the compiler is a `Diagnostic`:

```typescript
interface Diagnostic {
  severity:  "error" | "warning" | "info"
  code:      string        // e.g. "BML_UNKNOWN_TYPE"
  message:   string
  source:    SourceLocation
}

interface SourceLocation {
  file:    string          // BML source file path
  line:    number
  column:  number
}
```

Diagnostics always reference the BML source position — not the generated target output position. Source maps provide the reverse mapping for tooling that needs it.

The compiler never throws exceptions for recoverable errors. All errors are returned as diagnostics in `CompilerResult`. Unrecoverable internal errors (bugs) may throw.

---

## Error Handling

### Recoverable Errors

Reported as diagnostics with `severity: "error"`. Compilation continues where possible to collect all errors in one pass. `result.success` is `false` if any error-level diagnostic exists.

Examples:

```text
BML_UNKNOWN_TYPE              — referenced block type not found
BML_AMBIGUOUS_TYPE            — unqualified type name resolves to multiple candidates
BML_INVALID_PROPERTY          — property value does not match declared type
BML_MISSING_BASE_TYPE         — baseType not declared on a Block definition
BML_MISSING_BLOCK_TYPE        — root block lacks required type
BML_BLOCK_NAME_TYPE_MISMATCH  — root block name ≠ last segment of resolve(type)
BML_MISSING_SUBBLOCK_NAME     — Sub-Block lacks required name
BML_SUBBLOCK_TYPE_MISMATCH    — explicit Sub-Block type ≠ resolve(parent.type) + "." + name
BML_SUBBLOCKS_ON_SUBBLOCK     — Sub-Block declares subBlocks (root block only)
BML_INVALID_BLOCK_NAME        — Block name does not match [A-Z][a-zA-Z0-9]*
BML_MISSING_VERSION           — Block definition lacks effective version (no own <version> and not exported via Library)
BML_UNKNOWN_VERSION           — bml:version assert or lookup failed — no matching BlockDefinition in TypeRegistry
BML_VERSION_NOT_ALLOWED_IN_LIBRARY — bml:version present on BlockInstance inside Library bootstrap / _dependencies / _subLibraries / _blocks
BML_VERSION_BELOW_LIBRARY     — block.version < library.version when both declared (error)
BML_LIBRARY_NESTING_VIOLATION  — outer library _blocks re-exports a Block exported by a nested inner library
BML_VERSION_MINOR_DRIFT       — block.version minor differs from library.version (warning — best practice: patch only)
BML_MISSING_ID                — referenced instance or bml:each element lacks explicit id
BML_UNRESOLVABLE_INSTANCE_REF — blockId / placeId / FQN::id does not match any explicit id in target aggregation
BML_UNEXPORTED_INSTANCE_REF   — qualified {BlockFQN}::{id} targets a composition without export="true"
BML_NON_STATIC_INSTANCE_REF   — qualified reference or export target uses Expression instead of literal id/token
BML_EXPRESSION_TYPE_ERROR     — expression result type mismatch
BML_PROPERTY_CYCLE            — circular dependency in computed property value expressions
BML_VISIBILITY_MISMATCH       — visibility attribute or <visibility> element does not match naming convention
BML_VISIBILITY_ON_ROOT_BLOCK  — <visibility> declared on a root Block (Sub-Blocks only)
BML_PRIVATE_MEMBER_ACCESS     — private member used outside declaring Block
BML_PROTECTED_MEMBER_ACCESS   — protected member outside allowed inheritance/composition context
BML_PRIVATE_SUBBLOCK_ACCESS   — private Sub-Block referenced outside declaring Block
BML_PROTECTED_SUBBLOCK_ACCESS — protected Sub-Block outside allowed inheritance context
BML_DUPLICATE_MEMBER_VISIBILITY_VARIANT — members differ only by visibility prefix (normalized name collision)
BML_FINAL_MEMBER_OVERRIDE     — override attempted on final or private member
BML_OVERRIDE_WITHOUT_PARENT   — override="true" but no same-named parent member
BML_ABSTRACT_MEMBER_NOT_IMPLEMENTED — abstract member on a concrete block (must be explicitly implemented via abstract="false")
BML_READONLY_MEMBER_WRITE     — Block instance sets a member with readOnly=true
BML_STANDALONE_COMPOSITION     — <composition> not nested inside an aggregation member element
BML_UNKNOWN_NAMESPACE_PREFIX  — member element prefix references undeclared xmlns: prefix
BML_OUTSIDE_BML_NAMESPACE — Block FQN, xmlns binding, or Library export is outside <domain>.bml.*
BML_DEPRECATED_MEMBER_NAMESPACE_ATTR — legacy namespace="…" attribute on member element
BML_PRESET_CYCLE              — circular dependency in basePresets chain
BML_UNKNOWN_CONTRACT          — contract Block FQN not in TypeRegistry
BML_CONTRACT_NOT_ON_ROOT      — <contracts> declared on a Sub-Block
BML_DUPLICATE_CONTRACT        — same contract Block referenced twice
BML_CONTRACT_MEMBER_KIND_MISMATCH — override uses a different member kind than merged member
BML_SUGGESTIONS_ON_ENUM       — <suggestions> declared on an enum-type property
BML_CONSTRAINT_UNKNOWN        — constraint Block type not in TypeRegistry or not a Constraint sub-type
BML_CONSTRAINT_TYPE_MISMATCH  — constraint generic T incompatible with property or element type
BML_CONSTRAINT_VALUE_MISMATCH — constraint instance property value incompatible with bound generic T
BML_VALIDATION_UNKNOWN        — validation Block type not in TypeRegistry or not a Validation sub-type
BML_CONSTRAINT_VIOLATION      — property value fails a constraint with validation="Error" (Min, Max, MinLength, …)
BML_CONSTRAINT_WARNING        — property value fails a constraint with validation:Warning
BML_CONSTRAINT_INFORMATION    — property value fails a constraint with validation:Information
BML_SUGGESTION_TYPE_MISMATCH  — suggestion Block instance type incompatible with property type
BML_CARDINALITY_VIOLATION     — aggregation occurrence constraint not satisfied (type notation)
BML_DUPLICATE_MEMBER_NAME     — member name used more than once in a block
BML_INVALID_PROPERTY_TYPE     — property or Capability type is not a ValueType
BML_UNKNOWN_BEAN              — @bean reference not found in aggregations
BML_CAPABILITY_LINK_MISMATCH  — capability linking: direction or inputType/outputType mismatch
BML_UNKNOWN_FUNCTION_PARAMETER — named capability call parameter not a StructType property
BML_DUPLICATE_FUNCTION_PARAMETER — duplicate named parameter in capability call
BML_MISSING_FUNCTION_PARAMETER — required struct property missing in capability call
BML_TOO_MANY_FUNCTION_PARAMETERS — excess positional parameters for inputType
BML_MIXED_FUNCTION_ARGUMENTS   — positional and named parameters mixed (default FunctionMapping)
BML_MIXED_TYPE_CONFIGURATION     — positional and named arguments mixed in ValueType {…} configuration
BML_UNKNOWN_TYPE_CONFIGURATION   — configuration key or positional index not a ValueType Property
BML_TYPE_CONFIGURATION_VIOLATION — configuration value incompatible with target Property type
BML_DUPLICATE_TYPE_CONFIGURATION — same ValueType Property configured twice
BML_PREFER_TYPE_CONFIGURATION    — constraint duplicates an available ValueType configuration Property (hint)
BML_MISSING_GENERIC_TYPE_ARGUMENT — generic application missing required type argument (e.g. bare Constant)
BML_MISSING_CONSTANT_VALUE       — Constant(T) reference without required {value=…} configuration
BML_CONSTANT_VALUE_MISMATCH      — Constant configured value incompatible with bound type T
BML_PREFER_CONSTANT_TYPE         — union literal alternative should desugar to Constant(T){value=…} (hint)
BML_MISSING_FUNCTION_MAPPING   — implementation requires FunctionMapping but none declared
BML_AMBIGUOUS_FUNCTION_MAPPING — capability call form maps ambiguously to inputType
BML_NO_TARGET                 — no registered target supports the block's baseType
BML_UNKNOWN_TARGET            — requested target name not registered
BML_FUNCTION_MISSING_MAIN     — no function named after the Capability found in CDATA
BML_FUNCTION_DUPLICATE_MAIN   — more than one function matches the Capability name
BML_IMPLEMENTATION_UNKNOWN_LANGUAGE — <implementation language="..."> is not a known org.blockml.bml.language.* FQN
BML_FUNCTION_NO_RUNTIME_IMPL  — Transformation Capability called with non-literal args but no runtime impl
BML_DUPLICATE_GENERIC           — duplicate generic parameter name on root Block
BML_GENERIC_BLOCK_NAME_COLLISION — generic parameter element name equals the Block's <name>
BML_GENERIC_SUBBLOCK_NAME_COLLISION — generic parameter element name equals a Sub-Block <name> in the same file
BML_UNQUALIFIED_BLOCK_REFERENCE — bare block reference without FQN or xmlns prefix at a general reference site (composition tag, baseType, aggregation/association type)
BML_SUBBLOCK_QUALIFIED_REFERENCE_REQUIRED — Sub-Block shares root Block name; bare short tag is ambiguous
BML_IMPLEMENTATION_NOT_SUPPORTED — <implementation language="..."> not listed in baseType languages
BML_UNCLOSED_EMBEDDED_EXPRESSION — <$ in implementation CDATA without matching $>
BML_INVALID_EMBEDDED_EXPRESSION — nested or malformed <$ $> region in implementation
BML_UNKNOWN_CAPABILITY — Capability referenced in embedded expression does not exist
BML_UNKNOWN_SERVICE — #namespace in embedded expression is not a registered built-in service
```

### Warnings

Reported as diagnostics with `severity: "warning"`. Compilation succeeds. `result.success` may still be `true`.

Examples:

```text
BML_UNKNOWN_PROPERTY   — property not defined on block type (custom property assumed)
BML_UNKNOWN_DIRECTIVE  — unrecognized bml:* attribute name (always error)
BML_DIRECTIVE_NOT_ALLOWED — known bml:* directive on disallowed element (always error)
BML_DEPRECATED_TYPE    — referenced type is deprecated
```

---

## Capability Implementation Transpilation

A `utility Sub-Block` Sub-Block binds target-language implementations to Transformation Capabilities via `<implementation language="...">` — using **`org.blockml.bml.language.*`** FQNs.

Two implementation languages are supported in V1:

**`language="org.blockml.bml.language.OpenSCAD"`** — OpenSCAD function(s) written directly in the BML. The compiler prefixes all function names with the block FQN.

**`language="org.blockml.bml.language.TypeScript"`** — TypeScript arrow function. Compile-time execution only (V1): when all arguments at the call site are literals, the compiler executes the TS function in Node.js and emits the result as a literal. Runtime transpilation to OpenSCAD is deferred (requires LLM or dedicated transpiler).

### SCAD Implementation Rules

Each Capability has exactly one `<implementation>` block. The implementation contains:

```text
- Exactly one main function whose name matches the Capability name
- Zero or more helper functions with any names
- Optional BML Embedded Expressions (<$ … $>) for language-neutral Capability references
- All function names are replaced by the compiler with the block-FQN-prefixed form
```

**BML Embedded Expressions:** BlockML Capability calls inside implementation source use `<$ … $>` delimiters — not raw `#built-in` or FQN-prefixed target calls in author source. See `10_expression_language.md` — BML Embedded Expressions.

**Name replacement:** The processor scans the CDATA for all `function <name>(` declarations — these are the names to replace. All occurrences (declarations + calls) are replaced via regex. Embedded expression regions are resolved **before** name replacement on the surrounding target-language text:

```text
formatValue    → mb__com__machineblocks__calibration__Calibrator__Utils__formatValue
replaceZeroDot → mb__com__machineblocks__calibration__Calibrator__Utils__replaceZeroDot
```

**Embedded expression resolution in SCAD CDATA:** `#math.*`, `#strings.*`, `#this.*`, and `@bean.*` inside `<$ $>` are parsed as BlockML expressions and mapped to SCAD by the renderer. The author never writes raw SCAD FQN calls or service import paths:

```scad
// Author writes:
function formatValue(x) =
    replaceZeroDot(str(<$ #math.round_n(x, 1) $>));

// Renderer emits (after embedded substitution + FQN prefixing):
function mb__...__Utils__formatValue(x) =
    mb__...__Utils__replaceZeroDot(str(bom__org__blockml__service__Math__round_n(x, 1)));
// + adds: use <.../blocks/org/blockml/bml/service/Math.scad>
```

**Example:**

```xml
<capability name="formatValue"
            type="org.blockml.bml.capability.Transformation"
            inputType="org.blockml.bml.type.Float"
            outputType="org.blockml.bml.type.Text">
  <implementation language="org.blockml.bml.language.OpenSCAD"><![CDATA[
// Main function — name matches capability name
function formatValue(x) =
    replaceZeroDot(str(<$ #math.round_n(x, 1) $>));

// Helper functions
function replaceZeroDot(s, i = 0) =
    (i >= len(s) - 1) ? s :
    (s[i] == "0" && s[i + 1] == ".")
        ? str(strPrefix(s, i), ".", replaceZeroDot(strSuffix(s, i + 2), 0))
        : replaceZeroDot(s, i + 1);

function strPrefix(s, k, i = 0) =
    (i >= k) ? "" : str(s[i], strPrefix(s, k, i + 1));

function strSuffix(s, k, i = 0) =
    (k + i >= len(s)) ? "" : str(s[k + i], strSuffix(s, k, i + 1));
  ]]></implementation>
</capability>
```

**Validation errors:**

```text
BML_FUNCTION_MISSING_MAIN    — no function named after the Capability found in CDATA
BML_FUNCTION_DUPLICATE_MAIN  — more than one function matches the Capability name
BML_IMPLEMENTATION_UNKNOWN_LANGUAGE — language attribute is not a known org.blockml.bml.language.* FQN
```

### Built-in Services — No Processor Needed

Built-in Services (`#math`, `#strings`, etc.) are defined as BML service Blocks in `@blockml/core` (SSOT). Their SCAD equivalents live in `scad-lib/blocks/org/blockml/bml/service/` as pre-rendered artifacts:

```text
FQN:  org.blockml.bml.service.Math  →  scad-lib/blocks/org/blockml/bml/service/Math.scad
```

`Math.scad` example:

```scad
function bom__com__bom__service__Math__min(a, b) = min(a, b);
function bom__com__bom__service__Math__max(a, b) = max(a, b);
function bom__com__bom__service__Math__round_n(x, n) = round(x * pow(10, n)) / pow(10, n);
function bom__com__bom__service__Math__floor(x) = floor(x);
function bom__com__bom__service__Math__ceil(x) = ceil(x);
function bom__com__bom__service__Math__abs(x) = abs(x);
function bom__com__bom__service__Math__clamp(x, lo, hi) = min(max(x, lo), hi);
```

The ScadBlockProcessor automatically adds `use` imports for each service file that the Block's expressions reference — no separate service processor needed.

### Future: LLM-Based Implementation

In V1, an Entity Sub-Block without a matching `<implementation language="org.blockml.bml.language.OpenSCAD">` for the SCAD target produces a `BML_FUNCTION_NO_RUNTIME_IMPL` error if called with non-literal arguments.

The natural next step is the LLM Engine: given the Capability signature (name, inputType, outputType) and its `<documentation>`, the LLM generates a correct target-language implementation. No `<implementation>` block needed:

```xml
<!-- Future: LLM generates implementation from signature + documentation -->
<capability name="formatValue"
            type="org.blockml.bml.capability.Transformation"
            inputType="org.blockml.bml.type.Float"
            outputType="org.blockml.bml.type.Text">
  <documentation>
    Formats a float by removing the leading zero before the decimal point.
    Examples: 0.1 → ".1"   -0.2 → "-.2"   3.0 → "3.0"
  </documentation>
  <!-- No <implementation> — LLM Engine generates it -->
</capability>
```

This also applies to `org.blockml.bml.language.TypeScript` → target transpilation: TS → OpenSCAD, TS → Python, TS → Java are all LLM tasks. The `<implementation language="org.blockml.bml.language.TypeScript">` then becomes the LLM's input spec rather than a directly executable artifact.

The Capability documentation is therefore not just for humans — it is a primary input for the LLM compiler. Well-written documentation directly improves generated implementation quality.

---

## Incremental Build

The CLI supports incremental builds — skipping compilation (and thumbnail generation) when hash inputs are unchanged. Applies to `bom compile --all`, single-file `bom compile`, and `bom watch`. Full specification: `14_compiler_runtime.md` — Incremental Build (C5).

### Strategy

Every output artifact has a canonical input set. Before work begins, the CLI computes `SHA-256(canonicalJSON(inputs))` and compares it to `.bom-cache/<output-path>.hash`. Match → skip. `--force` bypasses the cache.

Cache key is the **output path** — implicit and direct compiles of the same block share one `.scad.hash` file.

### Hash inputs (summary)

```text
Wall.scad
  - Wall.bml content hash
  - external BlockInstance refs (typeFqn + version), sorted
  - activeConfig profile hash (or null)
  - target + compiler package versions

Wall.json
  - WallPresets.bml content hash
  - stored Wall.scad hash (cascade)
  - activeConfig, target, compiler versions

Wall__brick-2x4.webp
  - stored Wall.json + Wall.scad hashes
  - OpenSCAD version
  - thumbnailPipelineVersion: "1"
```

### --all Behavior

```text
<block>        → Block compile    (hash check → skip if unchanged)
<block> (preset block) → implicit .scad   (same hash key as direct block compile)
               → Presets .json    (hash check → skip if unchanged)
               → thumbnails       (per-preset hash check)
```

Every file in `srcDir` is evaluated. Shared output paths deduplicate work via the cache.

### Hash Storage

```text
.bom-cache/
  com/martianmicro/anyclosure/
    Wall.scad.hash              →  sha256:<hex>
    Wall.json.hash
    Wall__brick-2x4.webp.hash
```

Mirror `outDir` structure. Add `.bom-cache/` to `.gitignore`. Implemented in `@blockml/cli` as `incrementalBuild.ts`.

---

## Source Maps

The compiler (via the Render Target) generates a Source Map V3 file alongside each output file:

```text
Wall.scad      — generated SCAD
Wall.scad.map  — Source Map V3
```

The source map records the BML source file path, line, and column for every generated output line. This allows:

```text
- Compiler diagnostics to reference BML source positions
- Editor tooling to navigate from generated output back to BML
- Debugging to stay in the BML authoring context
```

Source Map V3 is used as the format. It is language-agnostic and has established tooling support. Practical applicability to SCAD output is to be verified.

---

## Extension Mechanism

The compiler supports extension root types (e.g. `<device>`) without modifying the core. Extensions register:

```text
1. A root type name  (e.g. "device")
2. A BML→BOM mapping rule
3. A Render Target (or reuse an existing one)
4. A schema (XSD or JSON Schema)
```

Root type registration:

```typescript
import { registerRootType } from "@blockml/parser";

registerRootType({
  name:    "device",
  mapper:  deviceBmlToBomMapper,
  schema:  deviceXsdUrl
});
```

Target registration:

```typescript
import { registerTarget } from "@blockml/compiler";

registerTarget(new DeviceTarget());
```

---

## Testing Strategy

### Stage 1 — Correctness Tests

Manual verification tests that ensure the compiler produces semantically correct output.

```text
Input:    BML source file (hand-authored)
Expected: Reference output file (manually verified against the target library)
Test:     byte-for-byte or normalized diff

Coverage (SCAD target):
  - Block definition → SCAD module
  - Composite block → nested mb_block() calls
  - MachineBlocks Set definition → STEPS + view submodules
  - Preset blocks (_presets) → Customizer JSON (render target)
  - Expressions → correct SCAD expressions
  - Assembly patterns → correct mb_assembly_*() calls
  - Config profile → correct parameter defaults
  - Preset + inline override → correct merge
```

Correctness tests are the authoritative definition of correct compiler behavior. They are written and verified before snapshot tests are created.

### Stage 2 — Snapshot Tests (Regression)

Snapshot tests detect unintended changes to compiler output after the correctness baseline is established.

```text
Tool:       Jest or Vitest (--updateSnapshot flag)
Input:      same BML source files as correctness tests
Snapshot:   the verified correct output from Stage 1
Test:       current output vs. stored snapshot (diff)

Behavior:
  - Test fails if output changes unexpectedly
  - Snapshots are updated intentionally when a change is correct
  - Snapshots are committed to the repository
```

### Test File Organization

```text
tests/
  correctness/
    wall/
      Wall.bml            — input
      Wall.expected.scad  — manually verified reference
    corner/
      Corner.bml
      Corner.expected.scad
    set/
      DefaultEnclosureSet.bml
      DefaultEnclosureSet.expected.scad
    presets/
      presets/StandardPresets.bml   — @machineblocks/mbom fixture (preset block)
      Library.bml                   — @machineblocks/mbom fixture (Library)
      Standard.expected.json

  snapshots/
    wall/
      Wall.scad.snap
    corner/
      Corner.scad.snap
    ...
```

### Test Execution Order

```text
1. Correctness tests run first
2. If all correctness tests pass, snapshot tests run
3. A failing correctness test blocks snapshot comparison
```
