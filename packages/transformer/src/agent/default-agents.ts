export const DEFAULT_AGENTS_MD = `# BlockML Project Instructions

This repository contains a BlockML model. BML is the editable source of truth. The BOM is the canonical parsed representation.

The effective model includes local BML, workspace packages, and BlockML libraries from npm. Identify Blocks by FQN. Look up semantics in the model. Do not invent types, syntax, or capabilities.

A BlockML repository may contain anything besides BML — TypeScript, Java, OpenSCAD, tests, docs, a song, or any other files. There is no default companion language. Those files are not the model. Change BML first, then update companions to match the new BML: \`blockml compile\` when a target exists, or edit them directly (including by an LLM). Never invent model semantics only in companions, and never update companions first and retrofit BML.

BML libraries are packaged as npm packages by default. The BlockML toolchain is Node/npm. That is the *host* for models and tools — not the repository's product. Output, when a repo has one, is a companion artifact built from BML. It might be a Spring application, OpenSCAD, an npm package, or anything else; npm output is common, not required. An npm tree in the repo may be toolchain, BML libraries, product output, or several of these at once. Do not assume \`package.json\` is the product.

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

JSON only (default). Depth 0 is that Block only; default 1; cap 3. Budget 48 blocks. If \`truncated\` is non-empty, inspect the needed child FQN instead of raising depth. Live TypeRegistry — no cache file. Not a write format; do not round-trip Inspect JSON to BML. Unknown FQN exits 2. Documentation longer than 400 characters is truncated with an ellipsis and \`documentationTruncated=true\`. Aggregation members include authored composition instances (enum literals, Library catalog FQNs, nested Stage/Task fills). Capability members include \`implementation\` (language + truncated source).

### graph — how it connects

Inheritance, uses / used-by, members, and paths. Prefer named operations. Use \`graph schema\` before Cypher. Rebuild with \`graph index\` if the index is missing or stale. Unknown FQN exits 2 (same as inspect). \`path\` follows outgoing authored edges only (the same direction as \`uses\`); reverse questions use \`used-by\`. The graph database is exclusive; the CLI waits if another graph process holds the index.

\`\`\`bash
npx blockml graph index
npx blockml graph uses <fqn> [--depth n]
npx blockml graph used-by <fqn> [--depth n] [--origin workspace|dependency] [--relation REL] [--limit n]
npx blockml graph neighbors <fqn> [--depth n]
npx blockml graph ancestors <fqn>
npx blockml graph descendants <fqn>
npx blockml graph members <fqn>
npx blockml graph path <from-fqn> <to-fqn>
npx blockml graph query <cypher>
npx blockml graph schema
\`\`\`

\`uses\` / \`used-by\` / \`neighbors\` \`--depth\` is hops (default 1). \`members\` ignores \`--depth\`. \`--origin\`, \`--relation\`, and \`--limit\` filter those three operations (comma-separated origin/relation). Unknown FQN may print \`Did you mean …?\`. \`--help\` prints command usage and exits 0. \`graph schema\` names the Ladybug Cypher subset (no \`type()\`, no \`shortestPath()\`) and prints a working \`MATCH\` example.

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

### compile — render when a target exists

Renders derived output for registered targets (\`blockdoc\`, \`xsd\`, \`fatblock\`, …). Use this when the companion is a compile target: change BML, then recompile. Do not patch compile output to fix the model. Companions with no target are updated by direct edit after the BML change.

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
     → update companions to match (compile and/or edit)
\`\`\`

If syntax is unclear: inspect the type Block, then similar existing BML, then change. Do not guess.

Treat in-BML documentation as searchable knowledge. After dependency changes, rebuild \`search index\` if results look incomplete.

## Rules

- Change BML first. Then update companions from that BML (compile or direct edit). Companions are never SSOT.
- Prefer existing Blocks over new duplicates. Keep the change scoped.
- Do not edit \`node_modules\`.
- Do not commit, push, reset, or rewrite user git state unless asked.
- Report gaps instead of inventing unsupported solutions.
`;
