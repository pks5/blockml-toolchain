export const DEFAULT_AGENTS_MD = `# BlockML Project Instructions

This repository contains a BlockML model. Treat BML as the editable source of truth. Use the BlockML toolchain to discover, understand, validate, and transform the model.

The effective model can include BML libraries from npm dependencies and workspace packages.

## Core principles

- Everything is a Block.
- BML is the editable source format.
- The BOM is the canonical parsed representation.
- Generated outputs are derived artifacts and are not the source of truth.
- Prefer existing model definitions and conventions over inventing new ones.
- Use the model itself as the authoritative source for detailed BlockML semantics.

## Tooling

Use the project-local CLI:

\`\`\`bash
npx blockml search "<query>"
npx blockml validate
npx blockml validate --all
\`\`\`

\`validate\` is for ordinary project work. \`validate --all\` includes reachable BlockML libraries under \`node_modules\`.

Search before scanning directories. Identify Blocks by FQN. Modify BML source, then validate. Do not invent BlockML concepts that can be looked up in the model.

When in doubt, search the model rather than guessing.
`;
//# sourceMappingURL=default-agents.js.map