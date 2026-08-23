import { hitAt, memberTypeFqn } from "./hit-test.js";
function firstProse(entries) {
    const text = entries?.[0]?.text?.trim();
    return text ? text : undefined;
}
function typeMarkdown(fqn, isText, documentations, summaries) {
    const lines = [`**${fqn}**`];
    if (isText) {
        lines.push(isText);
    }
    const prose = firstProse(documentations) ?? firstProse(summaries);
    if (prose) {
        lines.push("", prose);
    }
    return lines.join("\n");
}
function memberMarkdown(member, typeFqn) {
    const lines = [`**${member.name}**`, `\`${member.kind}\``];
    if (typeFqn) {
        lines.push(`type: \`${typeFqn}\``);
    }
    const prose = firstProse(member.documentations) ?? firstProse(member.summaries);
    if (prose) {
        lines.push("", prose);
    }
    return lines.join("\n");
}
function languageMarkdown(metaFqn, member, workspace) {
    if (member) {
        const lines = [`**${member.name}**`, `\`${metaFqn}\` ${member.kind}`];
        const prose = firstProse(member.documentations) ?? firstProse(member.summaries);
        if (prose) {
            lines.push("", prose);
        }
        return lines.join("\n");
    }
    const registered = workspace.registry.get(metaFqn)?.block;
    return typeMarkdown(metaFqn, registered?.is, registered?.documentations, registered?.summaries);
}
export function hoverAt(text, filePath, position, workspace) {
    const hit = hitAt(text, filePath, position, workspace);
    if (!hit) {
        return null;
    }
    let markdown;
    if (hit.kind === "member") {
        markdown = memberMarkdown(hit.member, hit.typeFqn ?? memberTypeFqn(hit.member));
    }
    else if (hit.kind === "language") {
        markdown = languageMarkdown(hit.metaFqn, hit.member, workspace);
    }
    else {
        const registered = workspace.registry.get(hit.fqn)?.block;
        if (hit.fqn === hit.block.type) {
            markdown = typeMarkdown(hit.fqn, registered?.is ?? hit.block.is, registered?.documentations ?? hit.block.documentations, registered?.summaries ?? hit.block.summaries);
        }
        else {
            markdown = typeMarkdown(hit.fqn, registered?.is, registered?.documentations, registered?.summaries);
        }
    }
    return {
        contents: { kind: "markdown", value: markdown },
        range: hit.range,
    };
}
//# sourceMappingURL=hover.js.map