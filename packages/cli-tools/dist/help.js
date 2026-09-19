/** Short syntax printed on configuration errors. Not the --help page. */
export const USAGE = "Usage: blockml compile <target> [--out dir] [--src dir] [--libraries a,b]\n" +
    "       blockml compile fatblock [--include a,b] [--out dir] [--per-package]\n" +
    "       blockml compile <file> <document-target> [--src dir] [--include a,b] [--out dir]\n" +
    "       blockml validate [--all] [<file>] [--src dir] [--libraries a,b] [--verbose]\n" +
    "       blockml search <query> [--json] [--limit n] [--src dir] [--libraries a,b]\n" +
    "       blockml search index [--force] [--src dir] [--libraries a,b]\n" +
    "       blockml graph index [--force] [--src dir] [--libraries a,b]\n" +
    "       blockml graph neighbors|uses|used-by <fqn> [--json] [--depth n] [--origin o] [--relation r] [--limit n]\n" +
    "       blockml graph ancestors|descendants|members <fqn> [--json] [--depth n]\n" +
    "       blockml graph path <from> <to> [--json] [--depth n]\n" +
    "       blockml graph query <cypher> [--json]\n" +
    "       blockml graph schema [--json]\n" +
    "       blockml scan package <selector>… [--json] [--src dir] [--libraries a,b]\n" +
    "       blockml scan type <selector>… [--json] [--src dir] [--libraries a,b]\n" +
    "       blockml inspect <fqn> [--depth n] [--json] [--src dir] [--libraries a,b]\n" +
    "       blockml transform apply <execution-fqn> [--library path] [--verbose] [--parameters json] [--parameter-mappings json]\n" +
    "       blockml new <fqn> [--baseType fqn] [--is text] [--src dir] [--libraries a,b]\n" +
    "       blockml init <package-fqn> [--src dir] [--install]\n" +
    "       blockml --help";
export const GRAPH_USAGE = "Usage: blockml graph index [--force] [--src dir] [--libraries a,b]\n" +
    "       blockml graph neighbors|uses|used-by <fqn> [--json] [--depth n] [--origin o] [--relation r] [--limit n]\n" +
    "       blockml graph ancestors|descendants|members <fqn> [--json] [--depth n]\n" +
    "       blockml graph path <from> <to> [--json] [--depth n]\n" +
    "       blockml graph query <cypher> [--json]\n" +
    "       blockml graph schema [--json]\n" +
    "       blockml graph --help";
export const INSPECT_USAGE = "Usage: blockml inspect <fqn> [--depth n] [--json] [--src dir] [--libraries a,b]\n" +
    "       blockml inspect --help";
export const SCAN_USAGE = "Usage: blockml scan package <selector>… [--json] [--src dir] [--libraries a,b]\n" +
    "       blockml scan type <selector>… [--json] [--src dir] [--libraries a,b]\n" +
    "       blockml scan --help";
export const SEARCH_USAGE = "Usage: blockml search <query> [--json] [--limit n] [--src dir] [--libraries a,b]\n" +
    "       blockml search index [--force] [--src dir] [--libraries a,b]\n" +
    "       blockml search --help";
/** Root help page. SSOT: org.blockml.bml.cli.documentation.Help */
export const HELP = `Usage: blockml <command> [options]
       blockml --help

blockml is the BlockML toolchain CLI.

BML is the editable source of truth. Companions (TypeScript, HTML, XSD, …) are derived.
Change BML first, then compile or edit companions to match. Do not invent model semantics.

Invocation: npx blockml <command>
Do not install or upgrade @blockml/cli unless asked. If the CLI is missing, run npm ci.
If @blockml/cli is not a project dependency, report that and stop.

Discover the model with the CLI, not grep:
  search    where something is (find FQNs)
  scan      which packages or types match selectors
  inspect   give me this Block already resolved (effective members)
  graph     how it connects (inheritance, uses, used-by)
Generic grep, find, and file reads remain allowed. They are not the first way into the model.

Workflow:
  task → search or scan → FQNs → inspect (graph if structure) → targeted BML read → smallest BML edit → validate
       → update companions to match (compile and/or edit)

Commands:
  search      Find FQNs. Corpus is validate --all.
              blockml search <query> [--json] [--limit n]
              blockml search index [--force]
  scan        Packages or types matching selectors. Corpus is validate --all.
              blockml scan package|type <selector>…
  inspect     Resolved Block JSON (effective members).
              blockml inspect <fqn> [--depth n]
  graph       Inheritance, uses / used-by, members, paths.
              blockml graph uses|used-by|neighbors|ancestors|descendants|members <fqn>
              blockml graph path <from> <to>
              blockml graph query <cypher> | schema | index
  new         Create a Block .bml under the owning Library.
              blockml new <fqn> [--baseType FQN] [--is text]
  init        Scaffold a BlockML project (Library, package.json, AGENTS.md).
              blockml init <package-fqn> [--src dir] [--install]
  validate    Parser + semantic check. Default: project sources, not npm.
              blockml validate [--all] [<file>]
  compile     Render derived output for a registered target.
              blockml compile blockdoc|xsd|fatblock
  transform   Run a ModelTransformation.
              blockml transform apply <execution-fqn> [--library path]

Shared flags: --src dir, --libraries a,b, --json, --help / -h
Corpus for search, scan, inspect, and graph is the same as validate --all.
Exit codes: 0 success, 1 diagnostic errors, 2 usage or configuration error.

Run \`blockml <command> --help\` for flags, defaults, output, and constraints.`;
/** Printed help. SSOT: org.blockml.bml.cli.documentation.SearchCommand */
export const SEARCH_HELP = `Usage: blockml search <query> [--json] [--limit n] [--src dir] [--libraries a,b]
       blockml search index [--force] [--src dir] [--libraries a,b]
       blockml search --help

When: find FQNs before scanning directories.

Corpus is the same as validate --all. Missing or stale .blockml/search/ is rebuilt automatically before a query.
The sole positional token "index" is the rebuild subcommand. QUERY may be multiple unquoted tokens.

Flags:
  --json        SearchResult[] (fqn, name, file, score, library?)
  --limit n     max hits
  --force       full rebuild for search index
  --src / --libraries   corpus overrides

Human lines: score, FQN, relative file path.
Rebuild the index if results look stale or sources have changed.

Related: inspect (resolve a found FQN), graph (how it connects).`;
/** Printed help. SSOT: org.blockml.bml.cli.documentation.ScanCommand */
export const SCAN_HELP = `Usage: blockml scan package <selector>… [--json] [--src dir] [--libraries a,b]
       blockml scan type <selector>… [--json] [--src dir] [--libraries a,b]
       blockml scan --help

When: list every package or type in the corpus that matches one or more Core selectors.
Not full-text search — no score, no --limit, no index. Use search to find FQNs by words.

Corpus is the same as validate --all (live TypeRegistry). Matching is PackageSelector /
TypeSelector parseValue + matches. Multiple selectors are OR.

Subcommands:
  package   PackageSelector tokens → matching package identifiers
  type      TypeSelector tokens → matching type FQNs

Selectors:
  Exact name is the most specific selector (a PackageIdentifier or TypeIdentifier).
  * as a segment — exactly one segment. ** as a segment — one or more (1..n, not 0..n).
  * inside a segment — characters in that segment only.

  scan type pkg.*         types directly in pkg
  scan type pkg.**        types in pkg and all descendant packages
  scan type pkg.**.Name   Name only in child packages of pkg (not pkg.Name)
  scan package pkg.*      direct child packages (not pkg itself)
  scan package pkg.**     descendant packages (not pkg itself)

Quote tokens that contain * or ** so the shell does not expand them.

Flags:
  --json        string[] of matching identifiers
  --src / --libraries   corpus overrides

Human: one identifier per line, sorted. Empty: No matches. / [] . Invalid selector
or missing package|type / selectors: exit 2.

Examples:
  blockml scan type org.blockml.bml.core.Block
  blockml scan type 'org.blockml.bml.core.**'
  blockml scan package 'org.blockml.bml.*' --json

Related: search (find FQNs by text), inspect (resolve a found FQN).`;
/** Printed help. SSOT: org.blockml.bml.cli.documentation.InspectCommand */
export const INSPECT_HELP = `Usage: blockml inspect <fqn> [--depth n] [--json] [--src dir] [--libraries a,b]
       blockml inspect --help

When: you already know the FQN and need the Block already resolved.

Inspect returns compact JSON of a Block from the live TypeRegistry (same corpus as validate --all). No cache file.

Effective members are four optional lists (properties, aggregations, associations, capabilities) with no kind field; inherited included. Empty lists omitted. Expansion follows declared member types, contracts, subBlocks, and generic type arguments — not a copy of the ancestor chain; ancestors are FQN refs. genericTypes are declared parameters; bound types on an instance are SubBlocks of that instance, not of the generic parent.

Flags:
  --depth n     0 = that Block only; default 1; cap 3. Budget 48 blocks.
  --json        accepted and implied (output is always JSON)
  --src dir     source directory override
  --libraries   extra Library.bml seeds

If truncated is non-empty, inspect the needed child FQN instead of raising depth.
Not a write format; do not round-trip Inspect JSON to BML.
A .bml path is not an FQN; inspect may print Did you mean <root FQN>?
Unknown FQN exits 2. Block, member, and genericTypes documentation longer than 400 characters is truncated with an ellipsis and documentationTruncated=true.
Aggregation members include authored composition instances (enum literals, Library catalog FQNs, nested ModelOperation/Task fills).
Authored documentation see references are compact FQN + relation and are not expanded; first 8, referencesTruncated is the remaining count.
Capability members include implementation (language + truncated source).

Related: search (find the FQN), graph (how it connects).`;
/** Printed help. SSOT: org.blockml.bml.cli.documentation.GraphCommand */
export const GRAPH_HELP = `Usage: blockml graph index [--force] [--src dir] [--libraries a,b]
       blockml graph neighbors|uses|used-by <fqn> [--json] [--depth n] [--origin o] [--relation r] [--limit n]
       blockml graph ancestors|descendants|members <fqn> [--json] [--depth n]
       blockml graph path <from> <to> [--json] [--depth n]
       blockml graph query <cypher> [--json]
       blockml graph schema [--json]
       blockml graph --help

When: inheritance, uses / used-by, members, or paths.

Prefer named operations. Use graph schema before Cypher.
Rebuild with graph index if the index is missing or stale.
Unknown FQN exits 2 (same as inspect). May print Did you mean …?
path follows outgoing authored edges only (the same direction as uses); reverse questions use used-by.
The graph database is exclusive; the CLI waits if another graph process holds the index.

Flags:
  --depth n     uses / used-by / neighbors: hops (default 1). ancestors / descendants / path: max hops (default 16). members ignores --depth.
  --origin      workspace|dependency|unresolved (comma-separated); uses/used-by/neighbors only
  --relation    BASE_TYPE|MEMBER_TYPE|… (comma-separated); uses/used-by/neighbors only
  --limit n     cap the list after origin/relation filters (uses/used-by/neighbors)
  --json        machine-readable Graph API objects
  --force       full rebuild for graph index
  --src / --libraries   corpus overrides

graph schema names the Ladybug Cypher subset (no type(), no shortestPath()) and prints a working MATCH example.

Related: search, inspect.`;
/** Printed help. SSOT: org.blockml.bml.cli.documentation.ValidateCommand */
export const VALIDATE_HELP = `Usage: blockml validate [--all] [<file>] [--src dir] [--libraries a,b] [--verbose]
       blockml validate --help

When: check the model after edits. Ordinary project work.

Default (no file, no --all): semantic-validate project sources only (this package srcDir plus local packages/*). npm libraries stay on the registry for resolve.
--all: semantic-validate every document in the registry, including npm. Do not use --all as the default after every edit.
Single file: parse + compileBmlToBom against the full project registry.
file and --all together exit 2.

Validity is parse + semantic validate only. XSD is a render target (compile xsd) and is not consulted.
No target bootstrap. No output files written.

Flags:
  --all         entire reachable corpus, including npm
  --verbose     print srcDir, seeds, index, graph, validate set, registry files
  --src / --libraries   corpus overrides

Exit 0 on success; 1 on diagnostic errors; 2 on config errors.
After diagnostics: Validation succeeded|failed. Tested N block(s), M with errors, W warning(s), R recommendation(s).
Do not ignore validation errors caused by your changes.

Related: search, inspect.`;
/** Printed help. SSOT: org.blockml.bml.cli.documentation.CompileCommand */
export const COMPILE_HELP = `Usage: blockml compile <target> [--out dir] [--src dir] [--libraries a,b]
       blockml compile fatblock [--include a,b] [--out dir] [--per-package]
       blockml compile <file> <document-target> [--src dir] [--include a,b] [--out dir]
       blockml compile --help

When: a companion is a compile target. Change BML first, then recompile. Do not patch compile output to fix the model. Companions with no target are updated by direct edit after the BML change.

Targets: blockdoc (default), xsd, fatblock. Custom targets via targetPackages.

Flags:
  --out dir         output directory (defaults: blockdoc, schemas, invocation directory)
  --src / --libraries   corpus overrides
  --include a,b     fatblock embed include patterns
  --per-package     one {hostFqn}.fat.bml per local package with blockml.library (fatblock only; not with host file or --src)

fatblock without a host file uses package.json blockml.library as host.

Related: validate.`;
/** Printed help. SSOT: org.blockml.bml.cli.documentation.NewCommand */
export const NEW_HELP = `Usage: blockml new <fqn> [--baseType fqn] [--is text] [--src dir] [--libraries a,b]
       blockml new --help

When: create a new Block. Writes a .bml file under the owning Library package.

Defaults: --baseType org.blockml.bml.core.Block; --is is the short name.
Does not overwrite an existing file.
Prefer existing Blocks over new duplicates.

Related: inspect, validate.`;
/** Printed help. SSOT: org.blockml.bml.cli.documentation.InitCommand */
export const INIT_HELP = `Usage: blockml init <package-fqn> [--src dir] [--install]
       blockml init --help

When: turn a directory into a BlockML project. Writes a project Library, README,
package.json blockml.library pointer, and universal AGENTS.md / CLAUDE.md.

PACKAGE-FQN must contain a bml segment. Does not overwrite existing files.
Does not run npm install unless --install is passed.

Bootstrap a new repo with npx @blockml/cli init <package-fqn>.
Afterward use npx blockml.

Related: new, validate.`;
/** Printed help. SSOT: org.blockml.bml.cli.documentation.TransformCommand */
export const TRANSFORM_HELP = `Usage: blockml transform apply <execution-fqn> [--library path] [--verbose] [--parameters json] [--parameter-mappings json]
       blockml transform --help

When: run a ModelTransformation.

transform is a parent command. V1 defines apply only.
EXECUTION-FQN is a pending one-shot, an available template, or a template outside _meta.transform.
--library is a path to the target Library.bml. Omitted: cwd package.json blockml.library. Missing both is exit 2.

Pipeline stage constraints belong to the Execute / Reflect prompts, not here.

Flags:
  --library path    target Library.bml for _meta (default: cwd package.json blockml.library)
  --verbose         stream additional agent-session detail
  --parameters json           JSON value for parameters (object merge when T is StructType)
  --parameter-mappings json   JSON array of ParameterMapping objects; ignores --parameters

Only one transform may run at a time in the same Git worktree
(nearest enclosing toplevel; cwd may be a package directory).
The worktree must be clean at start and before each ModelOperation.

Related: validate, inspect.`;
export function helpFor(command) {
    switch (command) {
        case "graph":
            return GRAPH_HELP;
        case "inspect":
            return INSPECT_HELP;
        case "search":
            return SEARCH_HELP;
        case "scan":
            return SCAN_HELP;
        case "validate":
            return VALIDATE_HELP;
        case "compile":
            return COMPILE_HELP;
        case "new":
            return NEW_HELP;
        case "init":
            return INIT_HELP;
        case "transform":
            return TRANSFORM_HELP;
        default:
            return HELP;
    }
}
//# sourceMappingURL=help.js.map