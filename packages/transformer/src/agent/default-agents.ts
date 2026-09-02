export const DEFAULT_AGENTS_MD = `# BlockML Project Instructions

This repository contains a BlockML model. BML is the editable source of truth. The BOM is the canonical parsed representation. Generated outputs are derived artifacts, not the source of truth.

The effective model includes local BML, workspace packages, and BlockML libraries from npm. Identify Blocks by FQN. Look up semantics in the model. Do not invent types, syntax, or capabilities.

## Tools

Use the project-local CLI:

\`\`\`bash
npx blockml <command>
\`\`\`

Do not install or upgrade \`@blockml/cli\` unless asked. If the CLI is missing, run \`npm ci\` first. If \`@blockml/cli\` is not a project dependency, report that and stop.

Search answers where something is. Inspect answers: give me this Block already resolved. Graph answers how it connects.

Generic grep, find, and file reads remain allowed. They are not the first way into the model.

### search — find it

Find FQNs before scanning directories. Corpus is the same as \`validate --all\`.

\`\`\`bash
npx blockml search "<query>"
npx blockml search index
\`\`\`

Rebuild the index if results look stale or sources have changed.

### inspect — understand a known FQN

Once search returns FQNs, inspect the relevant Block before opening a large \`.bml\` file. Members in the JSON are the **effective** set (inherited included). Expansion follows declared member types, contracts, and subBlocks — not a copy of the ancestor chain; ancestors are FQN refs.

\`\`\`bash
npx blockml inspect <fqn> [--depth n]
\`\`\`

JSON only (default). Depth 0 is that Block only; default 1; cap 3. Budget 48 blocks. If \`truncated\` is non-empty, inspect the needed child FQN instead of raising depth. Live TypeRegistry — no cache file. Not a write format; do not round-trip Inspect JSON to BML. Unknown FQN exits 2.

### graph — how it connects

Inheritance, uses / used-by, members, and paths. Prefer named operations. Use \`graph schema\` before Cypher. Rebuild with \`graph index\` if the index is missing or stale.

\`\`\`bash
npx blockml graph uses <fqn>
npx blockml graph used-by <fqn>
npx blockml graph ancestors <fqn>
npx blockml graph path <from-fqn> <to-fqn>
npx blockml graph schema
\`\`\`

### new — create a Block

Writes a \`.bml\` file and adds it to the owning Library catalog.

\`\`\`bash
npx blockml new <fqn> [--baseType FQN] [--is text]
\`\`\`

### validate — check after edits

\`\`\`bash
npx blockml validate
npx blockml validate <file>
npx blockml validate --all
\`\`\`

\`validate\` is ordinary project work. \`--all\` is the complete reachable corpus, including npm libraries under \`node_modules\`. Do not use \`--all\` as the default after every edit. Do not ignore validation errors caused by your changes.

### compile — render artifacts

Renders derived output (\`blockdoc\`, \`xsd\`, \`fatblock\`). Do not patch generated files to fix the model; change BML and recompile.

\`\`\`bash
npx blockml compile blockdoc|xsd|fatblock
\`\`\`

### transform — run a ModelTransformation

\`\`\`bash
npx blockml transform apply <execution-fqn>
\`\`\`

Pipeline stage constraints belong to the Execute / Reflect prompts, not here.

## Workflow

\`\`\`text
task → search → FQNs → inspect (graph if structure) → targeted BML read → smallest BML edit → validate
\`\`\`

If syntax is unclear: inspect the type Block, then similar existing BML, then change. Do not guess.

Treat in-BML documentation as searchable knowledge. After dependency changes, rebuild \`search index\` if results look incomplete.

## Rules

- Modify BML source, not generated artifacts or \`node_modules\`.
- Prefer existing Blocks over new duplicates. Keep the change scoped.
- Do not commit, push, reset, or rewrite user git state unless asked.
- Report gaps instead of inventing unsupported solutions.
`;
