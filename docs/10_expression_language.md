# BOM Compiler — Expression Language

version: 1.1.0

## Purpose of this Document

This document is the authoritative reference for the BML Expression Language — the dynamic value system used within `${ }` in BML documents.

For the BOM object model (`ExpressionValue`, `MemberValue`) see `12_bom_object_model.md`.
For MBOM-specific types and properties see `03_mbom.md`.

This document specifies both the **surface syntax** (EBNF, semantics) and the **formal AST** (`ExpressionNode` union) — the implementation contract for `@blockml/core` and `@blockml/parser`.

---

## Overview

The BML Expression Language is used wherever a Block member value needs to be dynamic — derived from other properties, computed, or bound to a service. Expressions appear inside `${ }` delimiters in BML attribute values.

The language is **extended JSON**: standard JSON syntax with four additions:

```text
1. Property references    myProp, myProp.x, myProp[0]
2. Model bindings         @model:/path, @model:relAttr
3. Bean calls             @bean.capa(...), @bean.capa
4. Built-in calls         #math.min(a, b), #strings.trim(s)
```

Everything else follows JSON: strings in double quotes, numbers, booleans `true`/`false`, `null`, arrays `[...]`, objects `{...}`.

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

literal        ::= string | number | boolean | null | array | object

string         ::= '"' [^"]* '"'
                 | "'" [^']* "'"

number         ::= '-'? [0-9]+ ('.' [0-9]+)?

boolean        ::= 'true' | 'false'

null           ::= 'null'

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
baseCutoutType="${ size[2] > 2 ? 'groove' : 'standard' }"
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
true            — boolean
false           — boolean
null            — null
```

### Arrays

```text
[1, 2, 3]
[size[0], size[1], 1]
[size[0], #math.max(size[1], 2), 0]
['groove', 'none', 'groove']
```

### Objects

```text
{x: 1, y: 0}
{x: size[0], y: size[1]}
{mode: 'groove', depth: size[2] - 1}
{label: @myModel:title, value: size[0]}
```

Objects inside `${ }` may contain expressions as values. Objects outside `${ }` (raw attribute values) are pure JSON literals only.

---

## Property Access

Accesses a member of the current Block instance. No prefix required.

```text
${ size }             — property value (e.g. Size3D [1, 8, 9])
${ size[0] }          — index access (x component)
${ size[1] }          — index access (y component)
${ size.x }           — attribute access (equivalent to size[0] for Size3D)
${ baseColor }        — string property
${ numberOfSamples }  — integer property
```

Nested access:

```text
${ config.mode }
${ items[0].size }
${ items[0].size[2] }
```

---

## Bean Calls (`@`)

User-defined Beans are declared as Aggregations with a `beanName` on the current Block. Beans are resolved by walking up the Composition hierarchy — context-scoped beans (`scope="context"`) are visible to all descendants.

### Sync Capability Call

```text
${ @myBean.format(value = size[0], unit = 'mm') }   — named parameters (Object payload)
${ @myBean.format({value: size[0], unit: 'mm'}) }   — object literal (equivalent)
${ @myBean.compute(size[0], size[1]) }              — positional (Array payload)
${ @myBean.compute([size[0], size[1]]) }            — array literal (equivalent)
${ @myBean.getLabel(size[0]) }                      — primitive payload
```

Named parameters `(a=x, b=y)` and object literal `({a:x, b:y})` are interchangeable for Object payloads. The return value of the Sync Capability is used as the expression result.

### Capability Linking

```text
${ @myBean.myOutbound }     — no parentheses = capability linking
```

Links an `AsyncOutbound` Capability of the Bean to the target member. The target must be an `AsyncInbound` Capability. Payload is forwarded without transformation. Both Capabilities must have compatible `payloadType`.

For `Sync → Sync` linking: payload type and return type must match.

### Direct Own-Block Access

A Block can reference its own Capabilities in Expressions without a prefix:

```text
${ mySyncCapa() }              — own Sync Capability call
${ mySyncCapa(a = 1, b = 2) } — with payload
${ myInbound }                 — own AsyncInbound linking (no parentheses)
```

The parser resolves ambiguity by checking the member namespace: `foo()` → Sync Capability, `foo` → Property or AsyncInbound (context-dependent).

---

## Model Binding (`@model:`)

Model Bindings connect a member value to a path in a ServiceBlock Model (JSONModel, ODataModel, etc.).

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

## Block-Scoped Functions (FunctionBlock)

Block-scoped functions are Sync Capabilities of a `FunctionBlock` Sub-Block, bound as a context-scoped bean. They are called in Expressions via the bean name and capability name:

```text
${ @utils.formatValue(valueStart + i * valueStep) }
```

> **V1 scope:** FunctionBlock calls use `@bean` syntax and are **not implemented in V1**. The example above illustrates the complete language.

The FunctionBlock is declared as a Sub-Block and bound via a context-scoped Aggregation:

```xml
<!-- Aggregation on parent Block: -->
<aggregation name="_utils"
             type="com.machineblocks.calibration.Calibrator.Utils"
             beanName="utils"
             scope="context" />

<!-- FunctionBlock Sub-Block: -->
<block>
  <name>Utils</name>
  <baseType>org.blockml.service.FunctionBlock</baseType>
  <version>1.0.0</version>
  <capabilities>
    <capability name="formatValue"
                type="org.blockml.capability.Sync"
                payloadType="org.blockml.type.Float"
                returnType="org.blockml.type.String">
      <implementation type="org.blockml.language.TypeScript"><![CDATA[
        (x: number): string => {
            const rounded = Math.round(x * 10) / 10
            return String(rounded)
                .replace(/^0\./, '.')
                .replace(/^-0\./, '-.')
        }
      ]]></implementation>
    </capability>
  </capabilities>
</block>
```

The `<implementation>` element is a child of `<capability>`. The **`type`** attribute identifies the implementation language as an `org.blockml.language.*` FQN (V1: `org.blockml.language.TypeScript`, `org.blockml.language.OpenSCAD`). The BlockProcessor transpiles the TypeScript to the target language, or executes it at compile time when all arguments are literals.

FunctionBlock calls follow the same syntax as regular `@bean` Sync Capability calls — there is no special syntax. The FunctionBlock pattern is the recommended replacement for the old `<functions>` section (which is now removed from the spec).

**Transition path:** when a FunctionBlock capability is later covered by a `#built-in`, the `<implementation>` is removed and the call site is updated from `@utils.formatValue(x)` to `#numbers.formatDecimal(x, 0, '.', 1)`. The Capability signature and all other call sites remain unchanged.

---

## Expressions in `defaultValue`

Property `defaultValue` may be a static literal or an Expression. When an Expression, it may reference other Properties of the same Block and `#built-in` functions:

```xml
<property name="numberOfSamples" type="Integer" defaultValue="5" />
<property name="labelSize"       type="Integer" defaultValue="5" />
<property name="size"            type="Size3D"
          defaultValue="${ [#math.max(2 * numberOfSamples + 1, labelSize), 12, 2] }" />
```

**Allowed roots in `defaultValue` expressions:**

```text
✓  Other Properties of the same Block
✓  #built-in functions
✗  @bean references
✗  @model bindings
✗  bml: loop variables
✗  bml:with variables
✗  own Capabilities
```

**Cycle detection:** The compiler resolves all `defaultValue` expressions via topological sort before compilation begins:

```text
1. Build dependency graph: which Properties reference which other Properties
2. Topological sort: resolve Properties with no dependencies first
3. Cycle detected → BML_PROPERTY_CYCLE error (lists the involved properties)
4. All resolved → proceed with compilation
```

A cycle occurs when Property A's `defaultValue` references Property B and B's `defaultValue` references A — directly or transitively. This is always an error, never a warning.

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
  payloadType: { x: Float, minInt: Integer, decPoint: String, minFrac: Integer }
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

## Capability Payload and Function Parameters

### Capabilities Have No Parameters — Only Payload

A Capability is a messaging concept — it has a payload, not a parameter list. The payload is an abstract message:

```text
payloadType options:
  Float, Integer, String, Boolean  — primitive
  Array<T>                         — homogeneous list, variable length
  { key: Type, ... }               — structured object with named keys
```

In a messaging context, the structure of the payload is irrelevant to transport. Any valid payload type works.

### FunctionBlock: Object Payload as Function Signature

A `FunctionBlock` interprets a Capability as a function. When the `payloadType` is a structured Object with named keys, it serves as the function signature:

```text
{ a: Float, b: Float }
  → Arity:      2  (number of keys)
  → Parameter names: a, b  (key names)
  → Positional call: #math.max(size[0], labelSize)
  → Named call:      #math.max(a=size[0], b=labelSize)
```

Both call syntaxes are always valid for Object payloads. The key order defines positional order.

**Single primitive payload** — no Object wrapper needed:

```text
payloadType: Float
  → Positional: #math.floor(x)
  → Named:      #math.floor(x=val)
```

**FunctionBlock implementation receives named parameters directly:**

```typescript
// payloadType: { a: Float, b: Float }
({a, b}: {a: number, b: number}): number => Math.max(a, b)

// payloadType: Float
(x: number): number => Math.floor(x)
```

**Array vs. Object payload:**

```text
Array<T>               — variable length, homogeneous, no named structure
                         → only positional with array literal: func([a, b])
{ a: T, b: T }         — fixed keys, named, ordered
                         → positional: func(a, b)
                         → named: func(a=x, b=y)
```

`Array<T>` payloads are not suitable as function signatures because arity is undefined. Use a structured Object for any FunctionBlock capability with fixed parameters.

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
<bml:block bml:each="x, xStat : ${ columns }">
  <core:NativeBlock
      bml:each="y, yStat : ${ rows }"
      id="${ 'brick_' + x + '_' + y }"
      offset="${ [x * blockSize[0], y * blockSize[1], 0] }"
      baseColor="${ (x + y) % 2 == 0 ? colorA : colorB }"
      connectors="${ #lists.concat(
        !xStat.first ? [{ face: 'x-', axis: 'z', type: 'female' }] : [],
        !xStat.last  ? [{ face: 'x+', axis: 'z', type: 'male'   }] : [],
        !yStat.first ? [{ face: 'y-', axis: 'z', type: 'female' }] : [],
        !yStat.last  ? [{ face: 'y+', axis: 'z', type: 'male'   }] : []
      ) }" />
</bml:block>
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

### `bml:block`

A virtual container that produces no Block output but applies directives to a group of children:

```xml
<bml:block bml:each="i : ${ numberOfSamples }">
    <Calibrator.Base  offset="${ [0, i * -3, 0] }" ... />
    <Calibrator.StudDiameter offset="${ [0, i * -3, 0] }" ... />
</bml:block>
```

### Dynamic Instance ID

Use the `id` meta property for dynamic IDs in loops — there is no `bml:id` directive:

```xml
<bricks:StandardBrick
    bml:each="i : ${ numberOfSamples }"
    id="${ 'sample_' + i }"
    offset="${ [2 * i, 0, 0] }" />
```

### `bml:with` — Local Variable Scope

```text
Syntax:  bml:with="var = ${ expression }"
         bml:with="var1 = ${ expr1 }, var2 = ${ expr2 }"

Allowed on:
  <composition>
  <bml:block>
  <? extends org.blockml.core.Block>
```

Defines local variables visible only within the element and its descendants. Variables are evaluated left-to-right — later variables can reference earlier ones in the same `bml:with`. Own Properties can be overridden within the local scope.

```xml
<!-- Local variable -->
<bricks:Standard
    bml:with="half = ${ size[0] / 2 }"
    offset="${ [half, 0, 0] }" />

<!-- Multiple variables -->
<bml:block bml:with="w = ${ size[0] - 1 }, h = ${ size[2] - 2 }">
  <core:NativeBlock size="${ [w, size[1], h] }" />
  <core:NativeBlock size="${ [w, size[1], 1] }" offset="${ [0, 0, h] }" />
</bml:block>

<!-- Override own property within scope -->
<bml:block bml:with="numberOfSamples = ${ numberOfSamples + 1 }">
  <Base numberOfSamples="${ numberOfSamples }" />
</bml:block>
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

@bean Sync Capability calls:
  — resolved by walking up the Composition hierarchy
  — context-scoped beans (scope="context") visible to all descendants
  — local beans (scope="local") visible only in declaring Block
  — FunctionBlock beans follow the same scoping rules

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
  — use on <composition> or <bml:block> to share values between sibling instances
  — shadows outer variables of the same name

defaultValue expressions:
  — only own Block Properties and #built-ins allowed
  — resolved before compilation via topological sort
  — cycles → BML_PROPERTY_CYCLE error
```

---

## Expression AST

The Expression Parser (compiler stage [7]) enriches each stage-[5] `ExpressionValue` — parsing `raw` into an AST on the BOM:

```typescript
interface ExpressionValue {
  kind: "expression"
  raw: string                    // source text inside ${ }
  ast: ExpressionNode            // root node — this section
  resultTypeFqn: string          // inferred or context-expected type
  source: SourceLocation
}
```

See `12_bom_object_model.md` — Member Values.

### Design Principles

```text
Parse, don't eval     — store AST; no runtime evaluation during parse/validate
                        (except literal fold diagnostics like division by zero)
Typed nodes           — every ExpressionNode carries resultTypeFqn after inference
EBNF 1:1              — each grammar production maps to one AST node kind
Immutable             — plain-data graph; same rules as BomDocument
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
  | NullLiteral
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
  | ModelBinding
```

---

### Literal Nodes

```typescript
interface StringLiteral extends ExpressionNodeBase {
  kind: "stringLiteral"
  value: string
  resultTypeFqn: "org.blockml.type.String"
}

interface NumberLiteral extends ExpressionNodeBase {
  kind: "numberLiteral"
  value: number
  /** integer when source has no decimal point; float otherwise */
  numericKind: "integer" | "float"
  resultTypeFqn: "org.blockml.type.Integer" | "org.blockml.type.Float"
}

interface BooleanLiteral extends ExpressionNodeBase {
  kind: "booleanLiteral"
  value: boolean
  resultTypeFqn: "org.blockml.type.Boolean"
}

interface NullLiteral extends ExpressionNodeBase {
  kind: "nullLiteral"
  resultTypeFqn: "org.blockml.type.Null"
}

interface ArrayLiteral extends ExpressionNodeBase {
  kind: "arrayLiteral"
  elements: ExpressionNode[]
  /** org.blockml.type.List<T> — T inferred from elements (must be compatible) */
  resultTypeFqn: string
}

interface ObjectLiteral extends ExpressionNodeBase {
  kind: "objectLiteral"
  properties: ObjectProperty[]
  /** Anonymous object type or declared payload shape when in call context */
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
${ [1, 2, size[0]] }
  → ArrayLiteral { elements: [NumberLiteral(1), NumberLiteral(2), AccessExpression(...)] }

${ {mode: 'groove', depth: size[2] - 1} }
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
${ size[0] }
  → AccessExpression {
       root: PropertyReference { name: "size", ... },
       accessors: [{ kind: "index", index: NumberLiteral(0) }]
     }

${ items[0].size[2] }
  → AccessExpression {
       root: PropertyReference { name: "items" },
       accessors: [
         { kind: "index", index: NumberLiteral(0) },
         { kind: "member", name: "size" },
         { kind: "index", index: NumberLiteral(2) }
       ]
     }
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

`defaultValue` expressions allow only step 3 (properties) and `#built-in` calls — no loop/with nodes.

---

### Call and Binding Nodes

```typescript
interface BuiltinCall extends ExpressionNodeBase {
  kind: "builtinCall"
  namespace: string          // e.g. "math"
  name: string               // e.g. "max"
  arguments: CallArgument[]
  /** FQN e.g. org.blockml.service.Math — from built-in registry */
  serviceFqn?: string
  capabilityName?: string
}

interface BeanSyncCall extends ExpressionNodeBase {
  kind: "beanSyncCall"
  beanName: string
  capabilityName: string
  arguments: CallArgument[]
  returnTypeFqn: string
}

interface BeanCapabilityLink extends ExpressionNodeBase {
  kind: "beanCapabilityLink"
  beanName: string
  capabilityName: string
  payloadTypeFqn: string
}

interface OwnSyncCall extends ExpressionNodeBase {
  kind: "ownSyncCall"
  capabilityName: string
  arguments: CallArgument[]
  returnTypeFqn: string
}

interface OwnCapabilityLink extends ExpressionNodeBase {
  kind: "ownCapabilityLink"
  capabilityName: string
  payloadTypeFqn: string
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
#math.max(a, b)           → BuiltinCall
@utils.formatValue(x)     → BeanSyncCall
@utils.myOutbound         → BeanCapabilityLink
myCapa(a=1)               → OwnSyncCall      (identifier + '(')
myInbound                 → OwnCapabilityLink OR PropertyReference
                              → resolved by member kind on current Block
@myModel:/path            → ModelBinding
@myModel:title            → ModelBinding (relative)
```

`funcCall` in EBNF is **`OwnSyncCall`** when the identifier names a Sync Capability on the current Block. When the same syntax appears with `@bean.` prefix, use **`BeanSyncCall`**.

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

| Stage | Responsibility |
|---|---|
| **Expression Parser** | Build AST; literal types; operator structure; call/binding shape |
| **Semantic Validator** | `resultTypeFqn` vs member type; resolve PropertyReference; bean/builtin existence; link/call legality; with/each scope; V1 deferred features |
| **Renderer** | Serialize AST → target syntax; emit helpers for processor-implemented built-ins |

The validator **does not mutate** AST nodes — it attaches diagnostics. Optional: a separate `ValidatedExpression` wrapper with resolved types if needed; V1 may enrich nodes in-place via optional fields (`memberTypeFqn?`).

---

### Package Ownership

```text
@blockml/core
  - ExpressionNode union and all interfaces in this section
  - Type inference helpers
  - validateExpression(ast, context): Diagnostic[]

@blockml/parser
  - Stage [5]: capture ExpressionValue { raw } during BML → BOM mapping
  - Stage [7]: parseExpression(raw, context) → fills ast + resultTypeFqn
  - Does NOT evaluate expressions

@blockml/compiler / render targets
  - Serialize ExpressionNode → SCAD / TS / JSON
  - Never re-parse raw strings from BOM
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
  resultTypeFqn: "com.machineblocks.type.Size3D"
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
Capability payload  → declared payloadType
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
@bean.capa(...)    — parentheses present = Sync Capability call
@bean.capa         — no parentheses = Capability linking (AsyncOutbound → AsyncInbound)
func(...)          — parentheses present = block-scoped function call
myCapa()           — own Sync Capability call (no prefix)
myInbound          — own AsyncInbound linking (no prefix, no parentheses)
```

The parser distinguishes call vs. link by the presence or absence of parentheses. Using `@bean.capa` (no parentheses) on a Sync Capability is a parse-time error. Using `@bean.capa()` (with parentheses) on an AsyncOutbound Capability is also a parse-time error.

---

## Error Cases

```text
BML_EXPR_SYNTAX_ERROR          — raw expression text fails to parse (stage [7])
BML_EXPR_UNKNOWN_PROPERTY      — identifier not found in scope (member, loop, with)
BML_EXPR_UNKNOWN_BEAN          — @bean not declared as Aggregation
BML_EXPR_UNKNOWN_BUILTIN       — #name not a registered built-in
BML_EXPR_TYPE_MISMATCH         — expression result type incompatible with member type
BML_EXPR_PAYLOAD_MISMATCH      — call syntax doesn't match declared payloadType
BML_EXPR_LINK_INVALID_SOURCE   — @bean.capa (no parens) on non-AsyncOutbound Capability
BML_EXPR_LINK_INVALID_TARGET   — capability linking target is not AsyncInbound
BML_EXPR_LINK_PAYLOAD_MISMATCH — linked Capabilities have incompatible payloadTypes
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
                 bml:block, bml:with
FunctionBlock:   Sub-Blocks with type="org.blockml.language.OpenSCAD" implementations (specified;
                 callable via @bean — deferred in V1)
```

**V1 — Deferred:**

```text
@bean calls        — no bean execution in V1 (includes FunctionBlock calls)
Model bindings     — no runtime model in V1
Capability linking — no runtime messaging in V1
#strings.*         — (except concat, length)
#bools.*
TypeScript ServiceBlocks / transpilation
```

---

## TypeScript ServiceBlock (Future)

A TypeScript-based ServiceBlock allows functions to be defined in TypeScript and transpiled to the target language by the BlockProcessor.

This is the mechanism for cases where:
- No `#built-in` covers the needed logic
- The logic is too complex for inline expressions
- The logic needs to be reusable across multiple Blocks

Specification deferred — to be defined when the first concrete use case requires it. The SCAD BlockProcessor would need a TypeScript→SCAD transpiler for a defined safe subset of TypeScript (pure functions, no I/O, no classes).
