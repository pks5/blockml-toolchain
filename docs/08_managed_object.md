# BOM Compiler — ManagedObject Model

version: 1.0.0

## Purpose of this Document

This document defines the BOM ManagedObject model — the runtime class hierarchy and generated API that backs every Block instance. It is the direct inspiration source for the `@blockml/core` implementation.

The BOM ManagedObject model is strongly inspired by the SAPUI5 ManagedObject pattern. Where BOM deviates from UI5, the deviation is documented explicitly with its rationale.

---

## Relationship to UI5 ManagedObject

SAPUI5's `ManagedObject` is one of the most battle-tested component models in enterprise software. It provides:

- Declarative metadata (properties, aggregations, associations, events)
- Automatically generated dedicated getters and setters
- Generic protected methods as the implementation backbone
- Change detection and invalidation

BOM adopts this pattern almost entirely. The key differences:

```text
UI5                          BOM
─────────────────────────────────────────────────────────
Control metadata             Block metadata
Properties                   Properties           (identical concept)
Aggregations                 Aggregations         (identical concept)
Associations                 Associations         (identical concept)
Events                       Capabilities         (extended: AsyncInbound, AsyncOutbound, Sync)
Renderer on Control          No renderer on Block (renderer lives in Target — fully separated)
suppressInvalidate param     Not needed           (no reactive DOM, compile-time only)
String property types        Address type added   (org.blockml.type.Address for Capability values)
```

The most important deviation: **the renderer is completely separated from the Block**. In UI5, a Control references its Renderer directly. In BOM, a Block has no knowledge of any renderer. The Target holds all renderers and dispatches per Block type. This makes it possible for the same Block model to be rendered by multiple Targets without any changes to the Block.

---

## Class Hierarchy

```text
ManagedObject                        — @blockml/core base class
  Block                              — adds metadata, compositions, preset resolution
    com.machineblocks.core.Block     — MBOM base (adds native MB properties)
      com.machineblocks.bricks.StandardBrick
      com.martianmicro.anyclosure.Wall
      ...
```

Every domain Block class ultimately extends `ManagedObject` via `Block`.

---

## ManagedObject — Generic Protected Methods

These methods are defined once on `ManagedObject` and implement all the shared logic: type validation, change tracking, namespace uniqueness enforcement, and internal state management.

Dedicated getters and setters (generated per member) always delegate to these methods — never to each other. This is the key pattern that makes subclass overrides clean.

### Properties and Capabilities

Capabilities use the same generic methods as Properties. Their value type is `Address` (`org.blockml.type.Address`) rather than a domain-specific type, but the mechanism is identical.

```typescript
protected setProperty(name: string, value: any): this
protected getProperty(name: string): any
```

### Aggregations (0..1)

```typescript
protected setAggregation(name: string, value: ManagedObject | null): this
protected getAggregation(name: string): ManagedObject | null
protected destroyAggregation(name: string): this
```

### Aggregations (0..n)

```typescript
protected addAggregation(name: string, value: ManagedObject): this
protected insertAggregation(name: string, value: ManagedObject, index: number): this
protected removeAggregation(name: string, value: ManagedObject): ManagedObject | null
protected removeAllAggregation(name: string): ManagedObject[]
protected getAggregation(name: string): ManagedObject[]
protected indexOfAggregation(name: string, value: ManagedObject): number
protected destroyAggregation(name: string): this
```

### Associations (0..1)

```typescript
protected setAssociation(name: string, id: string | null): this
protected getAssociation(name: string): string | null
```

### Associations (0..n)

```typescript
protected addAssociation(name: string, id: string): this
protected removeAssociation(name: string, id: string): string | null
protected removeAllAssociation(name: string): string[]
protected getAssociation(name: string): string[]
```

---

## Dedicated Getters and Setters

For every declared Member, dedicated getters and setters are generated. They are thin wrappers that delegate to the generic protected methods.

### Property Example

```typescript
// Block definition declares:
//   property name="size" type="com.machineblocks.type.Size3D" defaultValue="[1,1,1]"

// Generated:
getSize(): Size3D {
    return this.getProperty("size")
}

setSize(value: Size3D): this {
    return this.setProperty("size", value)
}
```

### Capability Example

Capabilities are declared with a class (`AsyncInbound`, `AsyncOutbound`, `Sync`) but their runtime value is an `Address`. The generated getter/setter follow the same pattern as Properties:

```typescript
// Block definition declares:
//   capability name="onResized" class="org.blockml.capability.AsyncOutbound"

// Generated:
getOnResized(): Address {
    return this.getProperty("onResized")
}

setOnResized(value: Address): this {
    return this.setProperty("onResized", value)
}
```

### Aggregation 0..n Example

```typescript
// Block inherits from com.machineblocks.core.CompositeBlock:
//   aggregation _parts: type="com.machineblocks.core.Block[]" default="true"
// Block inherits from com.machineblocks.core.Block:
//   aggregation _presets: type="com.machineblocks.core.Block[]"

// Generated:
getParts(): StandardBrick[] {
    return this.getAggregation("_parts") as StandardBrick[]
}

addPart(value: StandardBrick): this {
    return this.addAggregation("_parts", value)
}

insertPart(value: StandardBrick, index: number): this {
    return this.insertAggregation("_parts", value, index)
}

removePart(value: StandardBrick): StandardBrick | null {
    return this.removeAggregation("_parts", value) as StandardBrick | null
}

removeAllParts(): StandardBrick[] {
    return this.removeAllAggregation("_parts") as StandardBrick[]
}

indexOfPart(value: StandardBrick): number {
    return this.indexOfAggregation("_parts", value)
}

destroyParts(): this {
    return this.destroyAggregation("_parts")
}
```

### Aggregation 0..1 Example

```typescript
// Block definition declares:
//   aggregation name="tooltip" type="org.blockml.service.Formatter"

// Generated:
getTooltip(): Formatter | null {
    return this.getAggregation("tooltip") as Formatter | null
}

setTooltip(value: Formatter | null): this {
    return this.setAggregation("tooltip", value)
}

destroyTooltip(): this {
    return this.destroyAggregation("tooltip")
}
```

### Association Example

```typescript
// Block definition declares:
//   association name="targetDevice" type="com.electronics.core.Component"

// Generated:
getTargetDevice(): string | null {
    return this.getAssociation("targetDevice")
}

setTargetDevice(id: string | null): this {
    return this.setAssociation("targetDevice", id)
}
```

---

## The Override Pattern

The two-level design enables clean subclass overrides. A subclass overrides the dedicated setter and calls the generic protected method — not `super.setX()`:

```typescript
class MyBlock extends Block {

    // Override dedicated setter
    setSize(value: Size3D): this {
        // Custom logic before setting
        const clamped: Size3D = [
            Math.max(1, value[0]),
            Math.max(1, value[1]),
            Math.max(1, value[2])
        ]
        // Delegate to generic method — NOT super.setSize()
        return this.setProperty("size", clamped)
    }
}
```

Calling `super.setSize()` would be wrong — it would recursively call the overridden method. `this.setProperty()` is always the correct delegation target.

---

## Dedicated Method Naming Convention

Method names are derived from the member name using these rules:

### Properties and Capabilities

```text
get{MemberNamePascalCase}()
set{MemberNamePascalCase}(value)
```

### Aggregations (0..n)

The aggregation name is singularized for item-level methods:

```text
get{NamePascalCase}()                — returns array
add{NameSingularPascalCase}(value)
insert{NameSingularPascalCase}(value, index)
remove{NameSingularPascalCase}(value)
removeAll{NamePascalCase}()
indexOf{NameSingularPascalCase}(value)
destroy{NamePascalCase}()
```

Examples:

```text
aggregation "_parts":
  getParts()
  addPart(value)
  insertPart(value, index)
  removePart(value)
  removeAllParts()
  indexOfPart(value)
  destroyParts()

aggregation "children":
  getChildren()
  addChild(value)
  insertChild(value, index)
  removeChild(value)
  removeAllChildren()
  indexOf Child(value)
  destroyChildren()
```

Leading underscores on aggregation names (e.g. `_parts`) are stripped for method names.

### Aggregations (0..1)

```text
get{NamePascalCase}()
set{NamePascalCase}(value)
destroy{NamePascalCase}()
```

### Associations (0..1)

```text
get{NamePascalCase}()
set{NamePascalCase}(id)
```

### Associations (0..n)

```text
get{NamePascalCase}()
add{NameSingularPascalCase}(id)
remove{NameSingularPascalCase}(id)
removeAll{NamePascalCase}()
```

---

## Address Type

`org.blockml.type.Address` is a structured primitive type used as the value type for all Capabilities. It is parsed from the raw string value at parse time.

```typescript
interface Address {
    raw:          string          // original string as authored in BML
    scheme:       string | null   // "stud" | "http" | "mqtt" | "wot" | null
    path:         string          // the path component
    isAbsolute:   boolean         // true if starts with scheme:// or /
    isRelative:   boolean         // true if no scheme and no leading /
    isExpression: boolean         // true if starts with ${ 
}
```

Parsing rules:

```text
"stud://domain/path"          →  scheme="stud",  path="/domain/path",  isAbsolute=true
"http://api.example.com/x"    →  scheme="http",  path="//api.example.com/x", isAbsolute=true
"/path/to/resource"           →  scheme=null,    path="/path/to/resource",   isAbsolute=true
"relPath"                     →  scheme=null,    path="relPath",             isRelative=true
"${ @myService.getAddr() }"   →  isExpression=true, raw=...
```

`Address` is serialized back to its `raw` form for BML output and SCAD rendering.

---

## Code Generation vs. Runtime Registration

BOM ManagedObject dedicated methods can be provided in two ways:

**Option A — Static Code Generation:**
The compiler generates TypeScript classes with dedicated methods at build time. Each Block class is a real TypeScript class with fully typed methods.

**Option B — Runtime Registration (UI5 approach):**
The base class reads the metadata at runtime and dynamically attaches getter/setter methods to the prototype. No code generation needed.

Both approaches produce the same API surface. Option A gives better TypeScript type safety and IDE support. Option B is more dynamic and requires no build step for new Block types.

The recommended approach for `@blockml/core` is **Option A** for known domain types (MBOM) and **Option B** for dynamically loaded Block types (user-defined blocks loaded at runtime).

---

## No Renderer Reference on Block

This is an explicit deviation from UI5.

In UI5, a Control can reference its Renderer:
```javascript
Control.extend("my.Button", {
    metadata: { ... },
    renderer: "my.ButtonRenderer"
})
```

In BOM, a Block has no renderer reference. The Block is completely renderer-agnostic. The Target holds all Block Renderers and dispatches based on the Block's `baseType`. This means:

```text
The same Wall Block can be rendered by:
  scad     → Wall.scad
  unity    → Wall.prefab    (future)
  preview  → Wall.svg       (future)
```

Without any change to the Wall Block definition. The separation is total.
