import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bomEquals } from "@blockml/bom";
import { parse } from "@blockml/parser";
import {
  bootstrapTypeRegistry,
  defaultBootstrapPaths,
  forkBom,
  memberIdentityKey,
  resolveEffectiveMembers,
} from "../src/index.js";
import { TypeRegistry } from "../src/registry/type-registry.js";

const ROOT = join(import.meta.dirname, "..", "..", "..");

describe("forkBom", () => {
  it("deep-clones without sharing references", () => {
    const file = join(
      ROOT,
      "node_modules/@blockml/core/blocks/org/blockml/bml/core/Block.bml",
    );
    const { document } = parse(readFileSync(file, "utf8"), { filePath: file });
    expect(document).not.toBeNull();
    const fork = forkBom(document!);
    expect(bomEquals(document!, fork)).toBe(true);
    fork.block.is = "mutated";
    expect(document!.block.is).not.toBe("mutated");
  });
});

describe("resolveEffectiveMembers", () => {
  it("treats Integer.parseValue as concrete after override without abstract", () => {
    const { registry } = bootstrapTypeRegistry(defaultBootstrapPaths());
    const integer = registry.get("org.blockml.bml.type.Integer");
    expect(integer).toBeDefined();
    if (!integer) {
      return;
    }
    const parseValue = resolveEffectiveMembers(integer.block, registry).find(
      (m) => m.kind === "capability" && m.name === "parseValue",
    );
    expect(parseValue?.abstract).toBeUndefined();
    expect(parseValue?.kind === "capability" && parseValue.implementation).toBeTruthy();
  });

  it("merges members along baseType chain", () => {
    const { registry } = bootstrapTypeRegistry(defaultBootstrapPaths());
    const memberDef = registry.get("org.blockml.bml.definition.MemberDefinition");
    expect(memberDef).toBeDefined();
    if (!memberDef) {
      return;
    }
    const effective = resolveEffectiveMembers(memberDef.block, registry);
    const keys = effective.map(memberIdentityKey);
    expect(keys.length).toBeGreaterThan(0);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("does not inherit abstract/final/override from the parent layer", () => {
    const parent = parse(
      `<block xmlns="http://blockml.org/bml"
        xmlns:core="org.blockml.bml.core"
        xmlns:type="org.blockml.bml.type"
        xmlns:test="com.test.abstract">
        <type>test:Parent</type>
        <baseType>core:Block</baseType>
        <is>abstract parent</is>
        <properties>
          <label abstract="true" type="type:Text" />
        </properties>
      </block>`,
      { filePath: "<parent>" },
    );
    const child = parse(
      `<block xmlns="http://blockml.org/bml"
        xmlns:core="org.blockml.bml.core"
        xmlns:type="org.blockml.bml.type"
        xmlns:test="com.test.abstract">
        <type>test:Child</type>
        <baseType>test:Parent</baseType>
        <is>concrete child</is>
        <properties>
          <label override="true" type="type:Text">
            <value>ok</value>
          </label>
        </properties>
      </block>`,
      { filePath: "<child>" },
    );
    expect(parent.document).not.toBeNull();
    expect(child.document).not.toBeNull();
    const registry = new TypeRegistry();
    registry.register(parent.document!);
    registry.register(child.document!);
    const effective = resolveEffectiveMembers(child.document!.block, registry);
    const label = effective.find((m) => m.name === "label");
    expect(label?.abstract).toBeUndefined();
    expect(label?.override).toBe(true);
  });

  it("keeps abstract when the child restates it", () => {
    const parent = parse(
      `<block xmlns="http://blockml.org/bml"
        xmlns:core="org.blockml.bml.core"
        xmlns:type="org.blockml.bml.type"
        xmlns:test="com.test.abstractstay">
        <type>test:Parent</type>
        <baseType>core:Block</baseType>
        <is>abstract parent</is>
        <properties>
          <label abstract="true" type="type:Text" />
        </properties>
      </block>`,
      { filePath: "<parent>" },
    );
    const child = parse(
      `<block xmlns="http://blockml.org/bml"
        xmlns:core="org.blockml.bml.core"
        xmlns:type="org.blockml.bml.type"
        xmlns:test="com.test.abstractstay">
        <type>test:Child</type>
        <baseType>test:Parent</baseType>
        <is>still abstract</is>
        <properties>
          <label override="true" abstract="true" type="type:Text" />
        </properties>
      </block>`,
      { filePath: "<child>" },
    );
    expect(parent.document).not.toBeNull();
    expect(child.document).not.toBeNull();
    const registry = new TypeRegistry();
    registry.register(parent.document!);
    registry.register(child.document!);
    const effective = resolveEffectiveMembers(child.document!.block, registry);
    const label = effective.find((m) => m.name === "label");
    expect(label?.abstract).toBe(true);
  });

  it("honors override on redeclared members", () => {
    const source = `<block xmlns="http://blockml.org/bml"
      xmlns:core="org.blockml.bml.core"
      xmlns:type="org.blockml.bml.type"
      xmlns:test="com.test">
      <type>test:Child</type>
      <baseType>core:Block</baseType>
      <is>test</is>
      <version>1.0.0</version>
      <properties>
        <label type="type:Text" override="true">
          <value>child</value>
        </label>
      </properties>
    </block>`;
    const { document } = parse(source, { filePath: "<test>" });
    expect(document).not.toBeNull();
    const { registry } = bootstrapTypeRegistry(defaultBootstrapPaths());
    registry.register(document!);
    const effective = resolveEffectiveMembers(document!.block, registry);
    expect(effective.some((m) => m.name === "label")).toBe(true);
  });

  it("binds baseType instance configuration onto inherited properties", () => {
    const parent = parse(
      readFileSync(
        join(import.meta.dirname, "constraints/fixtures/parent-configurable-constant.bml"),
        "utf8",
      ),
      { filePath: "parent.bml" },
    );
    const child = parse(
      readFileSync(
        join(import.meta.dirname, "constraints/fixtures/valid-basetype-instance-config.bml"),
        "utf8",
      ),
      { filePath: "child.bml" },
    );
    expect(parent.document).not.toBeNull();
    expect(child.document).not.toBeNull();
    const registry = new TypeRegistry();
    registry.register(parent.document!);
    registry.register(child.document!);
    const expr = child.document!.block.baseTypeExpression;
    expect(expr?.kind).toBe("named");
    if (expr?.kind === "named") {
      expect(expr.fqn).toBe("com.blockml.test.constraints.ConfigurableConstant");
      expect(expr.instanceConfiguration?.positional?.[0]).toMatchObject({
        kind: "literal",
        value: true,
      });
    }
    const effective = resolveEffectiveMembers(child.document!.block, registry);
    const value = effective.find((m) => m.kind === "property" && m.name === "value");
    expect(value?.kind).toBe("property");
    if (value?.kind === "property") {
      expect(value.value).toMatchObject({ kind: "literal", value: true });
    }
  });
});
