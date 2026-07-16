# BOM Compiler — Expression Language

version: 1.2.0

## Purpose of this Document

This document is the authoritative reference for the BML Expression Language — the dynamic value system used within `${ }` in BML documents and within `<$ $>` in Capability `<implementation>` bodies.

For the BOM object model (`ExpressionValue`, `MemberValue`) see `12_bom_object_model.md`.
For MBOM-specific types and properties see `03_mbom.md`.

This document specifies both the **surface syntax** (EBNF, semantics) and the **formal AST** (`ExpressionNode` union) — the implementation contract for `@blockml/core` and `@blockml/parser`.

---

## Overview

The BML Expression Language is used wherever a Block member value needs to be dynamic — derived from other properties, computed, or bound to a service. Expressions appear inside `${ }` delimiters in BML attribute values.

The language is **extended JSON**: standard JSON syntax with four additions:

```text
1. Property references    myProp, myProp.x (StructType members by name only)
2. Model bindings         @model:/path, @model:relAttr
3. Bean calls             @bean.capa(...), @bean.capa
4. Built-in calls         #math.min(a, b), #strings.trim(s)
```

Everything else follows JSON subset rules: strings in double quotes, numbers, booleans, arrays `[...]`, objects `{...}`. Boolean literals in BML authoring and Expression Language accept case variants `true` / `True` / `TRUE` and `false` / `False` / `FALSE` (preferred lowercase). The BOM / AST always stores the canonical lowercase boolean. **`null` is not a BML literal** — absent/empty values are not typed as null; see `17_type_system_bml.md` — EMPTY.

---

## BML Embedded Expressions

**BML Embedded Expression** — language-neutral Capability references inside a Capability `<implementation>` body.

| Delimiter | Role |
|---|---|
| Opening | `<$` |
| Closing | `$>` |

The `<implementation>` CDATA body is **source text of the language named by `language`** — e.g. OpenSCAD, TypeScript. Regions wrapped in `<$ … $>` are **BlockML Expression Language** fragments. The renderer replaces each embedded region (including delimiters) with an equivalent expression in the target language; the surrounding implementation text is copied unchanged.

Embedded Expressions are **not** a separate implementation language and **not** a replacement for `<implementation>`. They are semantic embeds inside a concrete implementation:

```text
Implementation language  →  outer syntax (OpenSCAD, TypeScript, …)
BlockML Expression       →  referenced Capability semantics
Renderer                 →  resolution into target-language syntax
```

### Example

```xml
<implementation language="org.blockml.bml.language.OpenSCAD"><![CDATA[
function clamp(value) =
    <$ #math.max(
        #this.minimum(),
        #math.min(value, #this.maximum())
    ) $>;
]]></implementation>
```

After rendering to OpenSCAD, the embedded region may become:

```scad
function clamp(value) =
    max(minimum(), min(value, maximum()));
```

The author does not write renderer-specific function names, import paths, or FQN prefixes — only BlockML Expression references.

### Supported References

Embedded Expressions support at least these call forms:

```text
#this.someCapability(...)   — Capability on the Block that owns this implementation
#math.max(...)              — built-in service Capability
#strings.concat(...)        — built-in service Capability
@bean.someCapability(...)   — Capability on a bean bound in the current scope
```

| Form | Resolves to | Notes |
|---|---|---|
| `#this.foo(...)` | own Block Capability `foo` | **required** for self-references inside implementations; unqualified `foo(...)` is not supported here |
| `#math.foo(...)` | built-in service `#math` | same registry as `${ }` expressions |
| `@bean.foo(...)` | Transformation Capability on bound bean | same scope rules as `${ @bean.foo(...) }` |

Property access, operators, literals, and nested calls follow the same rules as `${ }` expressions unless noted otherwise.

### Delimiter Rules

```text
- Zero, one, or many embedded regions per implementation body
- Multiline expressions are supported; whitespace immediately after <$ and before $> is ignored
- Delimiters must not be nested: <$ … <$ … $> … $> is invalid
- An unclosed <$ without a matching $> is a parse/validation error
- Literal <$ or $> in implementation source must not appear outside a valid pair
```

Examples:

```text
return <$ #this.normalize(value) $>;
const min = <$ #this.minimum() $>;
const max = <$ #this.maximum() $>;

<$
    #math.max(
        #this.minimum(),
        value
    )
$>
```

### Parsing

The implementation body is stored as **complete original text**. The parser additionally extracts every embedded region:

```typescript
interface EmbeddedExpression {
  raw: string       // expression text between delimiters (trimmed for parsing)
  start: number     // start offset of opening <$ in source
  end: number       // end offset after closing $>
  ast?: ExpressionNode   // populated by parseExpression() utility — not Canonical BOM
}
```

Extraction runs during BML → BOM mapping (stage [5]). Each `raw` span is parsed with the same expression grammar as `${ }` values, extended with `#this` calls (see below). AST construction uses `parseExpression()` — same utility contract as member-value expressions.

### Embedded Expression Grammar Extension

Inside `<$ $>`, own Capability calls use the explicit `#this` prefix:

```ebnf
thisCall       ::= '#this' '.' identifier '(' argList? ')'
```

All other productions are identical to the main Expression Language grammar (see Formal Grammar). Embedded regions do **not** use `${ }` wrappers.

`#this.normalize(value)` parses as **`ThisCapabilityCall`** (embedded-only AST node) — semantically equivalent to `OwnSyncCall` in `${ }` context, but requiring the explicit prefix to avoid ambiguity with target-language identifiers in the surrounding source.

### Validation

Each embedded expression is validated with the same expression infrastructure as `${ }` values. **Capability existence is mandatory**; further checks may be added incrementally.

**`#this.foo(...)`** — validator resolves `foo` against the **effective member set** of the Block that owns the implementation:

```text
1. local Capabilities
2. inherited Capabilities (baseType chain)
3. Capabilities merged from contracts
```

If no Transformation (or callable) Capability named `foo` exists → `BML_UNKNOWN_CAPABILITY`.

**`#math.max(a, b)`** — validator checks:

```text
1. service namespace math resolves (#math → org.blockml.bml.service.Math)
2. Capability max exists on that service
```

Errors: `BML_UNKNOWN_SERVICE`, `BML_UNKNOWN_CAPABILITY`.

**`@formatter.format(value)`** — validator checks:

```text
1. bean formatter is in scope (Composition hierarchy, scope rules)
2. bean type declares Capability format
```

Errors: `BML_UNKNOWN_BEAN`, `BML_UNKNOWN_CAPABILITY`.

**Additional checks** (when expression/type infrastructure allows — may be phased in):

```text
- Capability kind permits invocation (Transformation vs Inbound/Outbound)
- argument count matches inputType (FunctionMapping)
- named parameters exist on inputType
- argument types compatible with inputType
- result type acceptable in surrounding implementation context
```

### Renderer Behaviour

The renderer receives:

```text
- original implementation source (full CDATA)
- embeddedExpressions[] with offsets and parsed AST
- resolved Capability references (from validation)
```

For each embedded region it **replaces the full span** `<$ … $>` with target-language syntax. Mapping is renderer-specific:

```text
<$ #math.max(a, b) $>     →  OpenSCAD: max(a, b)
                           →  TypeScript: Math.max(a, b)

<$ #this.minimum() $>     →  OpenSCAD: mb__…__minimum()  (FQN-prefixed per target rules)
                           →  TypeScript: this.minimum()
```

The parser and validator **never** emit target-specific names. Only the renderer produces final identifiers, imports, and call syntax.

See `06_compiler.md` — Capability Implementation Transpilation · `05_scad_renderer.md` — Built-in Service Resolution.

### Error Codes

```text
BML_UNCLOSED_EMBEDDED_EXPRESSION  — <$ without matching $>
BML_INVALID_EMBEDDED_EXPRESSION   — nested delimiters or malformed embedded region
BML_UNKNOWN_CAPABILITY            — referenced Capability not found on #this, service, or bean type
BML_UNKNOWN_SERVICE               — #namespace not a registered built-in service
BML_UNKNOWN_BEAN                  — @bean not in scope
```

Expression parse/type errors inside an embedded region reuse existing `BML_EXPR_*` and FunctionMapping diagnostics with source location mapped to the embedded span.

### Contrast with `${ }` Expressions

| Aspect | `${ }` (member values) | `<$ $>` (implementations) |
|---|---|---|
| Host context | BML attributes, `<value>`, directives | `<implementation>` CDATA body |
| Surrounding syntax | BML / JSON-like | Target language (OpenSCAD, TS, …) |
| Own Capability call | `myCapa(...)` or linking without prefix | `#this.myCapa(...)` only |
| Property access | yes (Block Properties) | only where valid in implementation context |
| `@bean` / `#built-in` | yes (with `${ }` scope rules) | yes |
| Evaluation | render-time / compile-time | render-time substitution into source |
| Stored in BOM | `ExpressionValue { raw }` on member | `EmbeddedExpression { raw, start, end }` on `ImplementationBlock` |

---

## Expression vs BOM Data Layer

> **Expressions and BOM member values are separate layers.** See `00_bom_core.md` — Expression layer vs BOM data layer.

| Layer | Stored where | Mutated by parser? |
|---|---|---|
| **BOM data** | `LiteralValue.value`, `ExpressionValue.raw` on `memberValues` | **No** — Canonical BOM, immutable |
| **Expression syntax** | `parseExpression()` utility output | **No** — separate result, not in BOM |
| **Expression evaluation** | `evaluateExpression()` / renderer working model | **No** — renderer only |

Property and member access in `${ }` (`size.x`) are **expression semantics** — they describe how to address a StructType field at evaluation time. Numeric index access on StructType members (`size[0]`) is not valid. They do **not** expand or normalize the underlying `size` literal in the BOM.

```text
BML attribute:  size="[5, 5, 6]"
BOM storage:    LiteralValue { value: [5,5,6], typeFqn: "…SizeXYZ" }   ← array stays array

BML attribute:  offset="${ size.x }"
Utility:        parseExpression("size.x") → { ast: MemberAccess(...), resultTypeFqn: "…" }
BOM storage:    ExpressionValue { raw: "size.x" }   ← raw only; AST is utility output
```

The StructType definition (field names, declaration order) is **type metadata** consulted by the expression type checker (stage [8]) and by the renderer at evaluation/serialization time. It is not applied to rewrite `LiteralValue.value` at parse time.

**Validation** checks that `size.x` is a valid member access on a `SizeXYZ`-typed `size` member. **Evaluation** (resolving `size.x` to `5`) happens at render time only.

---

## Formal Grammar (EBNF)

```ebnf
expression     ::= ternary

ternary        ::= logical ( '?' expression ':' expression )?

logical        ::= comparison ( ('&&' | '||') comparison )*

comparison     ::= additive ( ('==' | '!=' | '<' | '>' | '<=' | '>=') additive )*

additive       ::= multiplicative ( ('+' | '-') multiplicative )*

multiplicative ::= unary ( ('*' | '/' | '%') unary )*

unary          ::= ('-' | '!') unary
               | postfix

postfix        ::= primary ( '[' expression ']' | '.' identifier )*

primary        ::= literal
               | propertyAccess
               | builtinCall
               | beanCall
               | funcCall
               | modelBinding
               | '(' expression ')'

literal        ::= string | number | boolean | array | object

string         ::= '"' [^"]* '"'
                 | "'" [^']* "'"

number         ::= '-'? [0-9]+ ('.' [0-9]+)?

boolean        ::= 'true' | 'True' | 'TRUE' | 'false' | 'False' | 'FALSE'
                 — case variants of true/false; preferred lowercase; AST stores canonical lowercase


array          ::= '[' ( expression (',' expression)* )? ']'

object         ::= '{' ( key ':' expression (',' key ':' expression)* )? '}'

key            ::= string | identifier

propertyAccess ::= identifier ( '.' identifier | '[' expression ']' )*

builtinCall    ::= '#' identifier '.' identifier '(' argList? ')'

beanCall       ::= '@' identifier '.' identifier ( '(' argList? ')' )?
                 | capabilityLink

capabilityLink ::= '@' identifier '.' identifier   /* no parentheses = linking */

funcCall       ::= identifier '(' argList? ')'     /* block-scoped function */

modelBinding   ::= '@' identifier ':' path
                 | '@' identifier ':' '/' path

path           ::= ( identifier | number | '-' | '_' ) ( '/' ( identifier | number | '-' | '_' ) )*

argList        ::= arg (',' arg)*

arg            ::= identifier '=' expression       /* named parameter */
               | expression                        /* positional */

identifier     ::= [a-zA-Z_] [a-zA-Z0-9_]*
```

---

## Operator Precedence

From highest to lowest:

```text
1  (highest)  unary        -x  !x
2             postfix      x.y  x[i]
3             multiplicative  *  /  %
4             additive     +  -
5             comparison   ==  !=  <  >  <=  >=
6             logical      &&  ||
7  (lowest)   ternary      ? :
```

Left-associative at each level except ternary (right-associative).

---

## String Rules

Strings use double quotes `"..."` or single quotes `'...'`. Both are equivalent. Single quotes are useful inside attribute values already wrapped in double quotes:

```xml
baseCutoutType="${ size.z > 2 ? 'groove' : 'standard' }"
```

Escape sequences: `\"`, `\'`, `\\`, `\n`, `\t`.

---

## Identifier Rules

```text
Valid:    camelCase, PascalCase, snake_case, _leadingUnderscore
Start:    letter or _
Continue: letter, digit, or _
Examples: myProp, size, _parts, numberOfSamples, valueStart
```

Identifiers are resolved against the current Block's member namespace (Properties, Aggregations, Associations, Capabilities) — see Scope Rules.

---

## Whitespace

Whitespace (space, tab, newline) is ignored everywhere inside `${ }` except within string literals.

---

## Literals

### Primitives

```text
"hello"         — string (double quotes)
'hello'         — string (single quotes, equivalent)
42              — integer
3.14            — float
-0.5            — negative float
true            — boolean (also True, TRUE)
false           — boolean (also False, FALSE; preferred lowercase)
```

Absent or empty values are not expressed as `null` — omit the attribute, use `""` for empty String, or use a union sentinel (`"none"`, `false`, …). See `17_type_system_bml.md` — EMPTY.

### Arrays

```text
[1, 2, 3]
[size.x, size.y, 1]
[size.x, #math.max(size.y, 2), 0]
['groove', 'none', 'groove']
```

### Objects

```text
{x: 1, y: 0}
{x: size.x, y: size.y}
{mode: 'groove', depth: size.z - 1}
{label: @myModel:title, value: size.x}
```

Objects inside `${ }` may contain expressions as values. Objects outside `${ }` (raw attribute values) are pure JSON literals only.

---

## Property Access

Accesses a member of the current Block instance. No prefix required.

StructType property values are accessed **by property name only**. Numeric index access (`size[0]`) is not valid on StructType members — see `17_type_system_bml.md` — Struct Property Access · `18_function_mapping.md`.

This applies to **expression evaluation and type checking** — not to BOM storage. A `size` member authored as `[5,5,6]` remains `[5,5,6]` in `LiteralValue.value`; `${ size.x }` addresses the `x` field at evaluation time via type metadata.

```text
${ size }             — property value (e.g. SizeXYZ [1, 8, 9])
${ size.x }           — named member access (x component)
${ size.y }           — named member access (y component)
${ baseColor }        — string property
${ numberOfSamples }  — integer property
```

Nested access:

```text
${ config.mode }
${ items[0].size.x }   — collection index; struct member by name
```

Array/collection index access (`items[0]`) remains valid for collection-typed members. Index access on StructType values is not.

---

## Bean Calls (`@`)

User-defined Beans are registered on Block instances via `bml:bean`. Beans are resolved by walking up the Composition hierarchy — context-scoped beans (`bml:scope="context"`) are visible to all descendants.

### Transformation Capability Call

```text
${ @myBean.format(value = size.x, unit = 'mm') }   — named parameters (Object input)
${ @myBean.format({value: size.x, unit: 'mm'}) }   — object literal (equivalent)
${ @myBean.compute(size.x, size.y) }              — positional (FunctionMapping)
${ @myBean.compute([size.x, size.y]) }            — array literal (equivalent)
${ @myBean.getLabel(size.x) }                      — primitive input
```

Named parameters `(a=x, b=y)` and object literal `({a:x, b:y})` are interchangeable for Object input types. The output value of the Transformation Capability is used as the expression result.

### Capability Linking

```text
${ @myBean.myOutbound }     — no parentheses = capability linking
```

Links an `Outbound` Capability of the Bean to the target member. The target must be an `Inbound` Capability. The Outbound's `outputType` must match the Inbound's `inputType`.

For `Transformation → Transformation` linking: `inputType` and `outputType` must match.

### Direct Own-Block Access

A Block can reference its own Capabilities in Expressions without a prefix:

```text
${ myTransform() }              — own Transformation Capability call
${ myTransform(a = 1, b = 2) } — with input
${ myInbound }                 — own Inbound linking (no parentheses)
```

The parser resolves ambiguity by checking the member namespace: `foo()` → Transformation Capability, `foo` → Property or Inbound (context-dependent).

---

## Model Binding (`@model:`)

Model Bindings connect a member value to a path in a service Model (JSONModel, ODataModel, etc.).

```text
${ @myModel:/absolute/path }    — absolute path from model root
${ @myModel:relativeAttr }      — relative path, resolved against binding context
```

The `:` separator distinguishes Model Bindings from Bean Calls (`.`). An absolute path starts with `/`. A relative path is resolved against the binding context established by the nearest parent Aggregation bound to this model.

### Binding Context (Model Inheritance)

```xml
<List items="${ @myModel:/orders }">
    <ListItem label="${ @myModel:title }" />
</List>
```

Children within a Model-bound Aggregation inherit the binding context. Relative paths are resolved against the current element in the bound array.

---

## Block-Scoped Functions (utility Sub-Blocks)

Block-scoped functions are Transformation Capabilities of a `utility Sub-Block` Sub-Block, bound as a context-scoped bean. They are called in Expressions via the bean name and capability name:

```text
${ @utils.formatValue(valueStart + i * valueStep) }
```

> **V1 scope:** utility Sub-Block calls use `@bean` syntax and are **not implemented in V1**. The example above illustrates the complete language.

The utility Sub-Block is declared as a Sub-Block and bound via a context-scoped instance:

```xml
<!-- Aggregation on parent Block (structural + instance): -->
<aggregations>
  <_utils type="com.machineblocks.bml.calibration.Calibrator.Utils">
    <composition>
      <com.machineblocks.bml.calibration.Calibrator.Utils
          bml:bean="utils"
          bml:scope="context" />
    </composition>
  </_utils>
</aggregations>

<!-- utility Sub-Block: -->
<block>
  <name>Utils</name>
  <baseType>org.blockml.bml.core.Entity</baseType>
  <version>1.0.0</version>
  <capabilities>
    <formatValue
                type="org.blockml.bml.capability.Transformation"
                inputType="org.blockml.bml.type.Float"
                outputType="org.blockml.bml.type.Text">
      <implementation language="org.blockml.bml.language.TypeScript"><![CDATA[
        (x: number): string => {
            const rounded = <$ #math.round_n(x, 1) $>
            return <$ #strings.concat(
                #this.formatLeadingZero(rounded),
                String(rounded)
            ) $>
        }
      ]]></implementation>
    </formatValue>
  </capabilities>
</block>
```

The `<implementation>` element is a child of the capability member element. The **`language`** attribute identifies the implementation language as an `org.blockml.bml.language.*` FQN (V1: `org.blockml.bml.language.TypeScript`, `org.blockml.bml.language.OpenSCAD`). The BlockProcessor transpiles the TypeScript to the target language, or executes it at compile time when all arguments are literals.

utility Sub-Block calls follow the same syntax as regular `@bean` Transformation Capability calls — there is no special syntax. The utility Sub-Block pattern is the recommended replacement for the old `<functions>` section (which is now removed from the spec).

**Transition path:** when a utility Sub-Block capability is later covered by a `#built-in`, the `<implementation>` is removed and the call site is updated from `@utils.formatValue(x)` to `#numbers.formatDecimal(x, 0, '.', 1)`. The Capability signature and all other call sites remain unchanged.

---

## Expressions in `<value>`

Property `<value>` may contain a static literal or an Expression. When an Expression, it may reference other Properties of the same Block and `#built-in` functions:

```xml
<numberOfSamples type="Integer">
  <value>5</value>
</numberOfSamples>
<labelSize type="Integer">
  <value>5</value>
</labelSize>
<size type="SizeXYZ">
  <value>${ [#math.max(2 * numberOfSamples + 1, labelSize), 12, 2] }</value>
</size>
```

**Allowed roots in `value` expressions:**

```text
✓  Other Properties of the same Block
✓  #built-in functions
✗  @bean references
✗  @model bindings
✗  bml: loop variables
✗  bml:with variables
✗  own Capabilities
```

**Cycle detection:** The compiler resolves all `value` expressions via topological sort before compilation begins:

```text
1. Build dependency graph: which Properties reference which other Properties
2. Topological sort: resolve Properties with no dependencies first
3. Cycle detected → BML_PROPERTY_CYCLE error (lists the involved properties)
4. All resolved → proceed with compilation
```

A cycle occurs when Property A's `value` references Property B and B's `value` references A — directly or transitively. This is always an error, never a warning.

---

## Built-in Functions (`#`)

Built-in functions are always available in all Blocks of a domain. They are defined in the `baseType` hierarchy and accessible via the `#` prefix. The `#` namespace is reserved — user-defined beans cannot use `#`.

Built-ins are pure functions — no side effects, no state. They are resolved at compile time when all arguments are literals.

### `#math`

```text
#math.min(a, b)              — minimum of two numbers
#math.max(a, b)              — maximum of two numbers
#math.abs(x)                 — absolute value
#math.floor(x)               — round down to nearest integer
#math.ceil(x)                — round up to nearest integer
#math.round(x)               — round to nearest integer
#math.round(x, decimals)     — round to n decimal places
#math.pow(base, exp)         — base raised to exp
#math.sqrt(x)                — square root
#math.clamp(x, min, max)     — clamp x to [min, max]
```

### `#numbers`

```text
#numbers.formatDecimal(x, minIntDigits, decPoint, minFracDigits)
  inputType: { x: Float, minInt: Integer, decPoint: String, minFrac: Integer }
  outputType: String
  — format a number as a decimal string
  — positional: #numbers.formatDecimal(0.1, 0, '.', 1)  →  ".1"
  — named:      #numbers.formatDecimal(x=0.1, minInt=0, decPoint='.', minFrac=1)
  — minIntDigits=0 removes the leading zero (0.1 → .1)
```

### `#strings`

```text
#strings.trim(s)                    — remove leading/trailing whitespace
#strings.toUpperCase(s)             — uppercase
#strings.toLowerCase(s)             — lowercase
#strings.concat(a, b)               — concatenate (prefer + operator)
#strings.length(s)                  — string length
#strings.contains(s, sub)           — boolean
#strings.startsWith(s, prefix)      — boolean
#strings.endsWith(s, suffix)        — boolean
#strings.indexOf(s, sub)            — first index of sub in s, -1 if not found
#strings.substring(s, start, end)   — substring [start, end)
#strings.replace(s, old, new)       — replace first occurrence
#strings.replaceAll(s, old, new)    — replace all occurrences
```

### `#lists`

```text
#lists.size(list)                   — number of elements
#lists.isEmpty(list)                — boolean
#lists.contains(list, item)         — boolean
#lists.first(list)                  — first element
#lists.last(list)                   — last element
#lists.get(list, index)             — element at index
#lists.concat(a, b)                 — concatenate two lists → Array
#lists.sequence(start, end)         — integer list from start to end (inclusive)
                                      e.g. #lists.sequence(1, 5) → [1, 2, 3, 4, 5]
#lists.sequence(start, end, step)   — with step
                                      e.g. #lists.sequence(0, 10, 2) → [0, 2, 4, 6, 8, 10]
```

`#lists.concat` is particularly useful for building conditional arrays in Expressions:

```text
#lists.concat(
  condition1 ? [item1] : [],
  condition2 ? [item2] : [],
  condition3 ? [item3] : []
)
```

### `#bools`

```text
#bools.isTrue(x)                    — boolean coercion
#bools.isFalse(x)                   — boolean coercion
```

---

## Capability Input Types and Function Parameters

Capability call argument mapping is handled by **FunctionMapping** — see `18_function_mapping.md`. Anonymous struct `{ a: Float, b: Float }` and named StructType `inputType` values share the default FunctionMapping rules.

### Capabilities Have No Parameters — Only Typed Input/Output

A Capability declares typed data via `inputType` and/or `outputType`. In a messaging context, the structure is irrelevant to transport. Any valid type descriptor works.

```text
inputType / outputType options:
  Float, Integer, String, Boolean  — primitive
  { key: Type, ... }               — structured object with named keys
  { items: T[0..n] }               — collection field (multiplicity on reference)
```

### utility Sub-Block: Object inputType as Function Signature

A `utility Sub-Block` interprets a Capability as a function. When the `inputType` is a structured Object with named keys, FunctionMapping translates call syntax to the struct:

```text
{ a: Float, b: Float }
  → Arity:      2  (number of keys)
  → Parameter names: a, b  (key names)
  → Positional call: #math.max(size.x, labelSize)
  → Named call:      #math.max(a=size.x, b=labelSize)
  → Canonical:       #math.max({a: size.x, b: labelSize})
```

Positional parameter order follows **field declaration order** in `inputType` via FunctionMapping — not general StructType index semantics. See `18_function_mapping.md`.

**Single primitive inputType** — no Object wrapper needed:

```text
inputType: Float
  → Positional: #math.floor(x)
  → Named:      #math.floor(x=val)
```

**Capability implementation receives named parameters directly:**

```typescript
// inputType: { a: Float, b: Float }
({a, b}: {a: number, b: number}): number => Math.max(a, b)

// inputType: Float
(x: number): number => Math.floor(x)
```

**Collection field vs. Object input:**

```text
{ values: T[0..n] }    — variadic collection under a named field
                         → positional with sequence literal: func([a, b])
{ a: T, b: T }         — fixed keys, named, ordered
                         → positional: func(a, b)
                         → named: func(a=x, b=y)
```

`T[0..n]` is multiplicity on a type reference — not a separate Array type. Use a structured Object with named keys for fixed-arity utility Sub-Block capabilities. See `17_type_system_bml.md` — Collections and Multiplicity.

---

## SCAD Mapping

The SCAD BlockProcessor must map each built-in to SCAD output. Three strategies:

**Native SCAD** — direct 1:1 mapping:

```text
#math.min(a, b)    →  min(a, b)
#math.max(a, b)    →  max(a, b)
#math.abs(x)       →  abs(x)
#math.floor(x)     →  floor(x)
#math.ceil(x)      →  ceil(x)
#math.round(x)     →  round(x)          ← integer rounding only
#math.pow(b, e)    →  pow(b, e)
#math.sqrt(x)      →  sqrt(x)
#strings.concat(a,b) → str(a, b)
#strings.length(s)   → len(s)
```

**Processor-implemented** — SCAD expression generated inline by the processor:

```text
#math.round(x, 1)      →  round(x * 10) / 10
#math.round(x, n)      →  round(x * pow(10, n)) / pow(10, n)
#math.clamp(x, lo, hi) →  min(max(x, lo), hi)
#lists.sequence(s, e)  →  [s : e]                    ← SCAD range
#lists.sequence(s,e,st)→  [s : st : e]
#lists.size(list)      →  len(list)
#lists.get(list, i)    →  list[i]
#lists.first(list)     →  list[0]
#lists.last(list)      →  list[len(list) - 1]
```

**Processor-implemented with helper function** — the processor emits a SCAD helper function into the output file and calls it:

```text
#numbers.formatDecimal(x, 0, '.', 1)
  →  emits: function mb_built_in__numbers__formatDecimal(x, minInt, dec, minFrac) = ...
  →  calls: mb_built_in__numbers__formatDecimal(x, 0, ".", 1)

#strings.trim(s)
  →  emits helper function
  →  calls it

#strings.replace(s, old, new)
  →  emits recursive helper function (SCAD has no native replace)
  →  calls it
```

Helper functions emitted by the processor use the prefix `mb_built_in__` to avoid collisions with user-defined functions.

**Not mappable in V1** — explicitly excluded from V1 scope:

```text
#strings.toUpperCase    — no SCAD equivalent, not needed in V1
#strings.toLowerCase    — no SCAD equivalent, not needed in V1
#strings.contains       — requires helper, not needed in V1
#strings.startsWith     — requires helper, not needed in V1
#strings.endsWith       — requires helper, not needed in V1
#strings.indexOf        — requires helper, not needed in V1
#strings.substring      — requires helper, not needed in V1
#strings.replaceAll     — requires helper, not needed in V1
#bools.*                — not needed in SCAD context
```

---

## `bml:` Directives

Directives are special attributes in the `bml:` namespace that control Composition structure. They are not Block properties.

### `bml:each`

```text
Syntax:  bml:each="var : ${ expression }"
         bml:each="var, statName : ${ expression }"
```

The stat variable name is arbitrary — choose any valid identifier. This is essential for nested loops to avoid name collision.

**Numeric loop:** expression evaluates to an Integer `n`. Loop variable runs from `0` to `n-1`:

```xml
<bricks:Standard
    bml:each="i : ${ numberOfSamples }"
    offset="${ [2 * i, 0, 0] }" />
```

**Collection loop:** expression evaluates to an Array. Loop variable is the current element:

```xml
<bricks:Standard
    bml:each="item, stat : ${ @myModel:/items }"
    size="${ item.size }" />
```

**Nested loops — named stat variables avoid collision:**

```xml
<bml:container bml:each="x, xStat : ${ columns }">
  <core:NativeBlock
      bml:each="y, yStat : ${ rows }"
      bml:id="${ 'brick_' + x + '_' + y }"
      offset="${ [x * blockSize[0], y * blockSize[1], 0] }"
      baseColor="${ (x + y) % 2 == 0 ? colorA : colorB }"
      connectors="${ #lists.concat(
        !xStat.first ? [{ face: 'x-', axis: 'z', type: 'female' }] : [],
        !xStat.last  ? [{ face: 'x+', axis: 'z', type: 'male'   }] : [],
        !yStat.first ? [{ face: 'y-', axis: 'z', type: 'female' }] : [],
        !yStat.last  ? [{ face: 'y+', axis: 'z', type: 'male'   }] : []
      ) }" />
</bml:container>
```

The outer loop's stat (`xStat`) remains visible inside the inner loop's scope.

**Stat variables:**

```text
stat.index   — 0-based current position
stat.count   — 1-based current position
stat.size    — total count
stat.first   — true when index == 0
stat.last    — true when index == size - 1
stat.even    — true when index is even (0-based)
stat.odd     — true when index is odd (0-based)
```

For numeric loops, the loop variable `i` equals `stat.index`. `stat.size` equals `n`.

### `bml:if`

```text
Syntax:  bml:if="${ expression }"
```

Includes the Block only when the expression evaluates to `true`. Combined with `bml:each`, `bml:if` is evaluated per iteration:

```xml
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    bml:if="${ i > 0 }"
    offset="${ [2 * i, 0, 0] }" />
```

### `bml:unless`

```text
Syntax:  bml:unless="${ expression }"
```

Includes the Block only when the expression evaluates to `false`. Negation of `bml:if`.

### `bml:container`

A virtual container that produces no Block output but applies directives to a group of children:

```xml
<bml:container bml:each="i : ${ numberOfSamples }">
    <Calibrator.Base  offset="${ [0, i * -3, 0] }" ... />
    <Calibrator.StudDiameter offset="${ [0, i * -3, 0] }" ... />
</bml:container>
```

### Dynamic Instance ID

Use `bml:id` for dynamic IDs in loops:

```xml
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    bml:id="${ 'sample_' + i }"
    offset="${ [2 * i, 0, 0] }" />
```

### `bml:with` — Local Variable Scope

```text
Syntax:  bml:with="var = ${ expression }"
         bml:with="var1 = ${ expr1 }, var2 = ${ expr2 }"

Allowed on:
  <composition>
  <bml:container>
  <? extends org.blockml.bml.core.Block>
```

Defines local variables visible only within the element and its descendants. Variables are evaluated left-to-right — later variables can reference earlier ones in the same `bml:with`. Own Properties can be overridden within the local scope.

```xml
<!-- Local variable -->
<bricks:Standard
    bml:with="half = ${ size.x / 2 }"
    offset="${ [half, 0, 0] }" />

<!-- Multiple variables -->
<bml:container bml:with="w = ${ size.x - 1 }, h = ${ size.z - 2 }">
  <core:NativeBlock size="${ [w, size.y, h] }" />
  <core:NativeBlock size="${ [w, size.y, 1] }" offset="${ [0, 0, h] }" />
</bml:container>

<!-- Override own property within scope -->
<bml:container bml:with="numberOfSamples = ${ numberOfSamples + 1 }">
  <Base numberOfSamples="${ numberOfSamples }" />
</bml:container>
```

**Scope rules:**
```text
- Visible only within the declaring element and its descendants
- Shadows outer variables of the same name
- Can reference Properties of the current Block
- Can override Properties in local scope (does not mutate the Property)
- Later variables in the same bml:with can reference earlier ones
```

---

## Scope Rules

```text
Property access (no prefix):
  — current Block instance only
  — no access to parent, grandparent, or sibling properties
  — direction is always parent → child (top-down)

@bean Transformation Capability calls:
  — resolved by walking up the Composition hierarchy
  — context-scoped beans (bml:scope="context") visible to all descendants
  — local beans (bml:scope="local") visible only in declaring Block
  — utility Sub-Block beans follow the same scoping rules

#built-in references:
  — always available, inherited via baseType
  — cannot be overridden

Model binding context:
  — inherited from nearest parent Aggregation bound to that model
  — relative paths only valid when binding context exists

bml:each loop variable:
  — visible only within the looped element and its children
  — shadows outer variables of the same name

bml:with variable:
  — visible on the element and all descendants
  — use on <composition> or <bml:container> to share values between sibling instances
  — shadows outer variables of the same name

value expressions:
  — only own Block Properties and #built-ins allowed
  — resolved before compilation via topological sort
  — cycles → BML_PROPERTY_CYCLE error
```

---

## Expression AST

The **`parseExpression()` utility** (`@blockml/core`) parses `ExpressionValue.raw` into an AST. Output is a **utility result** — not written into Canonical BOM:

```typescript
/** Utility result — NOT part of Canonical BomDocument */
interface ParsedExpression {
  raw: string
  ast: ExpressionNode
  resultTypeFqn?: string
  source: SourceLocation
}
```

Canonical BOM stores only:

```typescript
interface ExpressionValue {
  kind: "expression"
  raw: string
  source: SourceLocation
}
```

See `12_bom_object_model.md` — Member Values · `00_bom_core.md` — Framework Utilities.

### Design Principles

```text
Parse, don't eval     — parseExpression() builds AST; evaluateExpression() is renderer/utility
Typed nodes           — every ExpressionNode carries resultTypeFqn after inference
EBNF 1:1              — each grammar production maps to one AST node kind
Immutable BOM         — raw in Canonical BOM; AST in utility output or working model
Renderer-independent  — SCAD/TS renderers serialize AST nodes; never re-parse raw
Context annotation    — unresolved names are errors; resolved names carry member metadata
```

### Base Types

```typescript
/** Every AST node */
interface ExpressionNodeBase {
  kind: string
  /** Inferred type FQN of this node's value */
  resultTypeFqn: string
  source: SourceLocation
}

interface SourceLocation {
  file?: string
  line: number
  column: number
  offset?: number
  length?: number
}

/** Positional or named call argument */
type CallArgument =
  | { style: "positional"; value: ExpressionNode }
  | { style: "named"; name: string; value: ExpressionNode }
```

### `ExpressionNode` Union

Root type of `ExpressionValue.ast`:

```typescript
type ExpressionNode =
  // Literals
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | ArrayLiteral
  | ObjectLiteral
  // Grouping
  | GroupExpression
  // Operators
  | UnaryExpression
  | BinaryExpression
  | ConditionalExpression
  // Access chains (postfix)
  | AccessExpression
  // References (primary identifiers)
  | PropertyReference
  | LoopVariableReference
  | WithVariableReference
  // Calls and bindings
  | BuiltinCall
  | BeanSyncCall
  | BeanCapabilityLink
  | OwnSyncCall
  | OwnCapabilityLink
  | ThisCapabilityCall       // embedded implementation only — #this.capa(...)
  | ModelBinding
```

---

### Literal Nodes

```typescript
interface StringLiteral extends ExpressionNodeBase {
  kind: "stringLiteral"
  value: string
  resultTypeFqn: "org.blockml.bml.type.Text"
}

interface NumberLiteral extends ExpressionNodeBase {
  kind: "numberLiteral"
  value: number
  /** integer when source has no decimal point; float otherwise */
  numericKind: "integer" | "float"
  resultTypeFqn: "org.blockml.bml.type.Integer" | "org.blockml.bml.type.Float"
}

interface BooleanLiteral extends ExpressionNodeBase {
  kind: "booleanLiteral"
  value: boolean
  resultTypeFqn: "org.blockml.bml.type.Boolean"
}

// No NullLiteral — BML has no null. Absent/empty is not an expression node; see EMPTY in 17_type_system_bml.md.

interface ArrayLiteral extends ExpressionNodeBase {
  kind: "arrayLiteral"
  elements: ExpressionNode[]
  /** org.blockml.bml.type.List<T> — T inferred from elements (must be compatible) */
  resultTypeFqn: string
}

interface ObjectLiteral extends ExpressionNodeBase {
  kind: "objectLiteral"
  properties: ObjectProperty[]
  /** Anonymous object type or declared input shape when in call context */
  resultTypeFqn: string
}

interface ObjectProperty {
  key: string
  value: ExpressionNode
  source: SourceLocation
}

interface GroupExpression extends ExpressionNodeBase {
  kind: "group"
  expression: ExpressionNode
}
```

**Examples:**

```text
${ [1, 2, size.x] }
  → ArrayLiteral { elements: [NumberLiteral(1), NumberLiteral(2), AccessExpression(...)] }

${ {mode: 'groove', depth: size.z - 1} }
  → ObjectLiteral { properties: [{key:"mode", ...}, {key:"depth", ...}] }
```

---

### Operator Nodes

Map directly to EBNF precedence levels:

```typescript
type UnaryOperator = "-" | "!"
type BinaryOperator =
  | "+" | "-" | "*" | "/" | "%"
  | "==" | "!=" | "<" | ">" | "<=" | ">="
  | "&&" | "||"

interface UnaryExpression extends ExpressionNodeBase {
  kind: "unary"
  operator: UnaryOperator
  operand: ExpressionNode
}

interface BinaryExpression extends ExpressionNodeBase {
  kind: "binary"
  operator: BinaryOperator
  left: ExpressionNode
  right: ExpressionNode
}

interface ConditionalExpression extends ExpressionNodeBase {
  kind: "conditional"
  condition: ExpressionNode
  consequent: ExpressionNode
  alternate: ExpressionNode
}
```

**Type inference:**

```text
Unary `-` on Integer/Float     → same numeric kind
Unary `!`                      → Boolean
Binary `+ - * / %`             → Float if any operand Float, else Integer
                                (+ on String: deferred — not in V1)
Binary comparisons / logical   → Boolean
Conditional `? :`              → consequent and alternate must be compatible;
                                 result type = narrower compatible type
```

---

### Access Expressions (Postfix Chain)

EBNF `postfix ::= primary ( '[' expression ']' | '.' identifier )*` becomes a single node with an accessor chain:

```typescript
interface AccessExpression extends ExpressionNodeBase {
  kind: "access"
  /** Primary at the start of the chain */
  root: PropertyReference | LoopVariableReference | WithVariableReference | GroupExpression
  accessors: AccessStep[]
}

type AccessStep =
  | { kind: "member"; name: string; source: SourceLocation }
  | { kind: "index"; index: ExpressionNode; source: SourceLocation }
```

**Examples:**

```text
${ size.x }
  → AccessExpression {
       root: PropertyReference { name: "size", ... },
       accessors: [{ kind: "member", name: "x" }]
     }

${ items[0].size.z }
  → AccessExpression {
       root: PropertyReference { name: "items" },
       accessors: [
         { kind: "index", index: NumberLiteral(0) },
         { kind: "member", name: "size" },
         { kind: "member", name: "z" }
       ]
     }
```

Index `AccessStep` remains valid for **collection-typed** members. Index access on StructType values is a validation error.

```text
${ size[0] }   — parses as index AccessStep; validator rejects (StructType)
```

Each step narrows `resultTypeFqn` using the member/type registry (validator).

---

### Reference Nodes

Primary identifiers before postfix accessors:

```typescript
interface PropertyReference extends ExpressionNodeBase {
  kind: "property"
  name: string
  /** Filled by validator from resolveEffectiveMembers() */
  memberKind?: "property" | "capability" | "aggregation" | "association"
  memberTypeFqn?: string
}

interface LoopVariableReference extends ExpressionNodeBase {
  kind: "loopVariable"
  name: string
  /** From bml:each on ancestor element */
  loopKind: "numeric" | "collection"
}

interface WithVariableReference extends ExpressionNodeBase {
  kind: "withVariable"
  name: string
  /** From bml:with on ancestor element */
}
```

**Scope resolution order** for a bare `identifier`:

```text
1. bml:with variable on ancestor chain      → WithVariableReference
2. bml:each loop variable on ancestor chain → LoopVariableReference
3. current Block member namespace           → PropertyReference
4. not found                                → BML_EXPR_UNKNOWN_PROPERTY
```

`value` expressions allow only step 3 (properties) and `#built-in` calls — no loop/with nodes.

---

### Call and Binding Nodes

```typescript
interface BuiltinCall extends ExpressionNodeBase {
  kind: "builtinCall"
  namespace: string          // e.g. "math"
  name: string               // e.g. "max"
  arguments: CallArgument[]
  /** FQN e.g. org.blockml.bml.service.Math — from built-in registry */
  serviceFqn?: string
  capabilityName?: string
}

interface BeanSyncCall extends ExpressionNodeBase {
  kind: "beanSyncCall"
  beanName: string
  capabilityName: string
  arguments: CallArgument[]
  outputTypeFqn: string
}

interface BeanCapabilityLink extends ExpressionNodeBase {
  kind: "beanCapabilityLink"
  beanName: string
  capabilityName: string
  outputTypeFqn: string
}

interface OwnSyncCall extends ExpressionNodeBase {
  kind: "ownSyncCall"
  capabilityName: string
  arguments: CallArgument[]
  outputTypeFqn: string
}

interface OwnCapabilityLink extends ExpressionNodeBase {
  kind: "ownCapabilityLink"
  capabilityName: string
  inputTypeFqn: string
}

/** Embedded implementation only — #this.capa(...) inside <$ $> */
interface ThisCapabilityCall extends ExpressionNodeBase {
  kind: "thisCapabilityCall"
  capabilityName: string
  arguments: CallArgument[]
  outputTypeFqn: string
}

interface ModelBinding extends ExpressionNodeBase {
  kind: "modelBinding"
  beanName: string
  path: string               // "/orders/0/title" or "relativeAttr"
  isAbsolute: boolean
  resultTypeFqn: string
}
```

**Parse disambiguation** (see Distinguishing Call vs. Link):

```text
#this.minimum()          → ThisCapabilityCall   (embedded <$ $> only)
#math.max(a, b)           → BuiltinCall
@utils.formatValue(x)     → BeanSyncCall
@utils.myOutbound         → BeanCapabilityLink
myCapa(a=1)               → OwnSyncCall      (identifier + '(')
myInbound                 → OwnCapabilityLink OR PropertyReference
                              → resolved by member kind on current Block
@myModel:/path            → ModelBinding
@myModel:title            → ModelBinding (relative)
```

`funcCall` in EBNF is **`OwnSyncCall`** when the identifier names a Transformation Capability on the current Block. When the same syntax appears with `@bean.` prefix, use **`BeanSyncCall`**.

---

### AST Construction from EBNF

Mapping from grammar to tree (parser implementation guide):

```text
expression      → ConditionalExpression | delegate to logical
ternary         → ConditionalExpression if '?:' present, else logical result
logical         → left-associative BinaryExpression chain (&& ||)
comparison      → left-associative BinaryExpression chain
additive        → left-associative BinaryExpression chain (+ -)
multiplicative  → left-associative BinaryExpression chain (* / %)
unary           → UnaryExpression | postfix
postfix         → AccessExpression wrapping primary + accessors
primary         → literal | reference | call | binding | GroupExpression
```

---

### Validation Responsibilities

| Component | Responsibility |
|---|---|
| **parseExpression()** | Build AST from `raw`; literal types; operator structure; call/binding shape |
| **validateConstraints()** | `resultTypeFqn` vs member type; resolve PropertyReference; bean/builtin existence |
| **evaluateExpression()** | Resolve to value — renderer working model only |
| **Renderer** | Serialize AST → target syntax; emit helpers for processor-implemented built-ins |

Utilities **never mutate** Canonical BOM. Diagnostics are returned separately.

---

### Package Ownership

```text
@blockml/core
  - ExpressionNode union and ParsedExpression interface
  - EmbeddedExpression interface on ImplementationBlock
  - parseExpression(raw, context) → ParsedExpression
  - parseEmbeddedExpressions(source) → EmbeddedExpression[]  (delimiter scan + parseExpression per region)
  - validateExpression(ast, context): Diagnostic[]
  - evaluateExpression(ast, context) → value (renderer/working model)

@blockml/parser
  - Stage [5]: capture ExpressionValue { raw } during BML → BOM mapping
  - Stage [5]: extract EmbeddedExpression { raw, start, end } from ImplementationBlock.source
  - Does NOT parse or evaluate expressions

@blockml/compiler / render targets
  - Call parseExpression() / evaluateExpression() as needed in renderer pipeline
  - Serialize ExpressionNode → SCAD / TS / JSON
```

---

### Worked Example

Source:

```xml
size="${ [#math.max(2 * numberOfSamples + 1, labelSize), 12, 2] }"
```

AST (abbreviated):

```text
ExpressionValue
  raw: "[#math.max(2 * numberOfSamples + 1, labelSize), 12, 2]"
  resultTypeFqn: "com.machineblocks.bml.type.SizeXYZ"
  ast: ArrayLiteral
    elements:
      [0] BuiltinCall { namespace:"math", name:"max",
            arguments: [
              positional: BinaryExpression { operator:"+", left:
                BinaryExpression { operator:"*", left: PropertyReference(numberOfSamples),
                                   right: NumberLiteral(2) },
                right: NumberLiteral(1) },
              positional: PropertyReference(labelSize)
            ] }
      [1] NumberLiteral(12)
      [2] NumberLiteral(2)
```

---

## Type Inference

Expression result types are inferred from context:

```text
Property type       → expected result type
Capability input    → declared inputType
Arithmetic result   → Float if any operand is Float, else Integer
Comparison result   → Boolean
Ternary result      → union of both branch types (must be compatible)
Array literal       → List<T> where T is inferred from elements
Object literal      → anonymous Object
```

A type mismatch between the inferred/explicit `resultTypeFqn` on the root AST node and the expected member type is a validation error (`BML_EXPR_TYPE_MISMATCH`).

Each sub-node carries its own `resultTypeFqn` — used for operator compatibility checks and renderer dispatch.

---

## Distinguishing Call vs. Link

```text
@bean.capa(...)    — parentheses present = Transformation Capability call
@bean.capa         — no parentheses = Capability linking (Outbound → Inbound)
func(...)          — parentheses present = block-scoped function call
myCapa()           — own Transformation Capability call (no prefix)
myInbound          — own Inbound linking (no prefix, no parentheses)
```

The parser distinguishes call vs. link by the presence or absence of parentheses. Using `@bean.capa` (no parentheses) on a Transformation Capability is a parse-time error. Using `@bean.capa()` (with parentheses) on an Outbound Capability is also a parse-time error.

---

## Error Cases

```text
BML_EXPR_SYNTAX_ERROR          — raw expression text fails to parse (stage [7])
BML_EXPR_UNKNOWN_PROPERTY      — identifier not found in scope (member, loop, with); or index access on StructType
BML_EXPR_UNKNOWN_BEAN          — @bean not declared as Aggregation
BML_EXPR_UNKNOWN_BUILTIN       — #name not a registered built-in
BML_EXPR_TYPE_MISMATCH         — expression result type incompatible with member type
BML_EXPR_PAYLOAD_MISMATCH      — call syntax doesn't match declared inputType after FunctionMapping
BML_UNKNOWN_FUNCTION_PARAMETER — named call parameter not a StructType property
BML_DUPLICATE_FUNCTION_PARAMETER — duplicate named parameter in capability call
BML_MISSING_FUNCTION_PARAMETER — required struct property missing in capability call
BML_TOO_MANY_FUNCTION_PARAMETERS — excess positional parameters for inputType
BML_MIXED_FUNCTION_ARGUMENTS   — positional and named parameters mixed (default FunctionMapping)
BML_MISSING_FUNCTION_MAPPING   — implementation requires mapping but none declared
BML_AMBIGUOUS_FUNCTION_MAPPING — call form maps ambiguously to inputType
BML_EXPR_LINK_INVALID_SOURCE   — @bean.capa (no parens) on non-Outbound Capability
BML_EXPR_LINK_INVALID_TARGET   — capability linking target is not Inbound
BML_EXPR_LINK_PAYLOAD_MISMATCH — linked Capabilities have incompatible inputType/outputType
BML_EXPR_MODEL_NO_CONTEXT      — relative model path used without binding context
BML_EXPR_BUILTIN_NOT_V1        — built-in called that is excluded from V1 scope
BML_EXPR_DIVISION_BY_ZERO      — compile-time division by zero (literal operands only)
```

---

## V1 Scope

V1 implements a focused subset. Everything not listed here is deferred.

**V1 — Supported:**

```text
Literals:        string, number, boolean, array, object
Operators:       + - * / %  ==  != < > <= >=  &&  ||  !  ?:
Property access: myProp  myProp.x  myProp[i]
Arithmetic:      all standard operators
Ternary:         condition ? a : b
Built-ins:       #math.min/max/abs/floor/ceil/round/round(x,n)/pow/sqrt/clamp
                 #numbers.formatDecimal
                 #strings.concat/length
                 #lists.size/get/first/last/sequence
bml: directives: bml:each (numeric + collection), bml:if, bml:unless,
                 bml:container, bml:with
utility Sub-Block:   Sub-Blocks with type="org.blockml.bml.language.OpenSCAD" implementations (specified;
                 callable via @bean — deferred in V1)
```

**V1 — Deferred:**

```text
@bean calls        — no bean execution in V1 (includes utility Sub-Block calls)
Model bindings     — no runtime model in V1
Capability linking — no runtime messaging in V1
#strings.*         — (except concat, length)
#bools.*
TypeScript service Blocks / transpilation
```

---

## TypeScript service Block (Future)

A TypeScript-based service Block allows functions to be defined in TypeScript and transpiled to the target language by the BlockProcessor.

This is the mechanism for cases where:
- No `#built-in` covers the needed logic
- The logic is too complex for inline expressions
- The logic needs to be reusable across multiple Blocks

Specification deferred — to be defined when the first concrete use case requires it. The SCAD BlockProcessor would need a TypeScript→SCAD transpiler for a defined safe subset of TypeScript (pure functions, no I/O, no classes).
