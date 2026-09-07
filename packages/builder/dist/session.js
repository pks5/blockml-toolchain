import { BML_XMLNS, DEFAULT_BASE_TYPE, ENGLISH_FQN, orderedBindings, packageOfFqn, prefixForPackage, shortNameOfFqn, XSI_NS, } from "./namespaces.js";
function literalValue(value, typeFqn) {
    return { kind: "literal", value, typeFqn };
}
function ensureArrays(block) {
    block.members ??= [];
    block.subBlocks ??= [];
    block.embeddedBlocks ??= [];
    block.compositions ??= [];
}
function findMember(block, name, kind) {
    return block.members.find((member) => member.name === name && (kind === undefined || member.kind === kind));
}
function bindPackage(bindings, pkg) {
    if (pkg === BML_XMLNS || pkg === XSI_NS) {
        return;
    }
    const prefix = prefixForPackage(pkg, bindings);
    if (!Object.values(bindings).includes(pkg)) {
        bindings[prefix] = pkg;
    }
}
export class BomBuilder {
    document;
    constructor(document) {
        this.document = document;
        ensureArrays(this.document.block);
        this.document.source.namespaceBindings ??= {
            "": BML_XMLNS,
        };
    }
    static create(options) {
        const type = options.type.trim();
        if (!type) {
            throw new Error("BomBuilder.create requires type (FQN)");
        }
        const name = options.name?.trim() || shortNameOfFqn(type);
        const baseType = options.baseType?.trim() || DEFAULT_BASE_TYPE;
        const idea = options.is?.trim() || name;
        const bindings = {
            "": BML_XMLNS,
        };
        bindPackage(bindings, packageOfFqn(type));
        bindPackage(bindings, packageOfFqn(baseType));
        const source = {
            filePath: options.filePath ?? "",
            format: "xml",
            namespaceBindings: orderedBindings(bindings),
            rootForm: "type",
        };
        const block = {
            name,
            type,
            baseType,
            is: idea,
            members: [],
            subBlocks: [],
            embeddedBlocks: [],
            compositions: [],
        };
        if (options.documentation !== undefined) {
            block.documentations = [
                {
                    namespace: "",
                    text: options.documentation,
                    languageFqn: ENGLISH_FQN,
                },
            ];
        }
        return new BomBuilder({
            kind: "block",
            source,
            block,
        });
    }
    static edit(document) {
        return new BomBuilder(structuredClone(document));
    }
    setName(name) {
        this.document.block.name = name;
        return this;
    }
    setType(fqn) {
        this.document.block.type = fqn;
        this.ensurePackageBinding(packageOfFqn(fqn));
        return this;
    }
    setBaseType(fqn) {
        this.document.block.baseType = fqn;
        this.ensurePackageBinding(packageOfFqn(fqn));
        return this;
    }
    setIs(text) {
        this.document.block.is = text;
        return this;
    }
    setDocumentation(text) {
        this.document.block.documentations = [
            {
                namespace: "",
                text,
                languageFqn: ENGLISH_FQN,
            },
        ];
        return this;
    }
    setFilePath(filePath) {
        this.document.source.filePath = filePath;
        return this;
    }
    ensureNamespaceBinding(prefix, namespace) {
        const bindings = this.bindings();
        for (const uri of Object.values(bindings)) {
            if (uri === namespace) {
                return this;
            }
        }
        let next = prefix;
        if (bindings[next] && bindings[next] !== namespace) {
            next = prefixForPackage(namespace, bindings);
        }
        bindings[next] = namespace;
        this.document.source.namespaceBindings = orderedBindings(bindings);
        return this;
    }
    addProperty(options) {
        const existing = findMember(this.document.block, options.name);
        if (existing) {
            throw new Error(`Member already exists: ${options.name}`);
        }
        this.ensurePackageBinding(packageOfFqn(options.typeFqn));
        const property = {
            kind: "property",
            name: options.name,
            typeFqn: options.typeFqn,
        };
        if (options.value !== undefined) {
            property.value = literalValue(options.value, options.typeFqn);
        }
        this.document.block.members.push(property);
        return this;
    }
    addAggregation(options) {
        const existing = findMember(this.document.block, options.name);
        if (existing) {
            throw new Error(`Member already exists: ${options.name}`);
        }
        this.ensurePackageBinding(packageOfFqn(options.typeFqn));
        const aggregation = {
            kind: "aggregation",
            name: options.name,
            type: { kind: "named", fqn: options.typeFqn },
            authoredInAggregationsSection: true,
        };
        this.document.block.members.push(aggregation);
        return this;
    }
    addCompositionChild(aggregationName, typeFqn) {
        const member = findMember(this.document.block, aggregationName, "aggregation");
        if (!member || member.kind !== "aggregation") {
            throw new Error(`Aggregation not found: ${aggregationName}`);
        }
        this.ensurePackageBinding(packageOfFqn(typeFqn));
        let composition = member.composition;
        if (!composition) {
            composition = { aggregationName, children: [] };
            member.composition = composition;
            this.document.block.compositions.push(composition);
        }
        const already = composition.children.some((child) => child.kind === "blockInstance" && child.instance.typeFqn === typeFqn);
        if (already) {
            return this;
        }
        composition.children.push({
            kind: "blockInstance",
            instance: {
                typeFqn,
                memberValues: {},
            },
        });
        this.syncCompositionIndex(composition);
        return this;
    }
    setMemberValue(name, value) {
        const member = findMember(this.document.block, name, "property");
        if (!member || member.kind !== "property") {
            throw new Error(`Property not found: ${name}`);
        }
        member.value = literalValue(value, member.typeFqn || "org.blockml.bml.type.Text");
        return this;
    }
    querySelector(selector) {
        const trimmed = selector.trim();
        const dot = trimmed.indexOf(".");
        if (dot <= 0) {
            return undefined;
        }
        const section = trimmed.slice(0, dot);
        const name = trimmed.slice(dot + 1);
        if (section === "properties") {
            return findMember(this.document.block, name, "property");
        }
        if (section === "aggregations") {
            return findMember(this.document.block, name, "aggregation");
        }
        return undefined;
    }
    seal() {
        const sealed = structuredClone(this.document);
        ensureArrays(sealed.block);
        sealed.source.namespaceBindings = orderedBindings(sealed.source.namespaceBindings ?? { "": BML_XMLNS });
        return sealed;
    }
    bindings() {
        return { ...(this.document.source.namespaceBindings ?? {}) };
    }
    ensurePackageBinding(pkg) {
        if (!pkg) {
            return;
        }
        const prefix = prefixForPackage(pkg, this.bindings());
        this.ensureNamespaceBinding(prefix, pkg);
    }
    syncCompositionIndex(composition) {
        const compositions = this.document.block.compositions;
        if (!compositions.includes(composition)) {
            compositions.push(composition);
        }
    }
}
//# sourceMappingURL=session.js.map