import { SEQUENCE_STAGES } from "./constants.js";
import { getSequence } from "./properties.js";
import { parseExecutionFqn } from "./lifecycle.js";
/**
 * Assigns the next library-scoped execution sequence.
 *
 * Reads the highest `sequence` already present under
 * `<library>._transform.running`, `_transform.succeeded`, and
 * `_transform.failed`. Pending executions are ignored.
 * A file lock can wrap `nextSequence` later without changing callers.
 */
export class SequenceAllocator {
    nextSequence(libraryFqn, registry) {
        let max = 0;
        for (const fqn of registry.keys()) {
            const parsed = parseExecutionFqn(fqn);
            if (!parsed || parsed.libraryFqn !== libraryFqn) {
                continue;
            }
            if (!SEQUENCE_STAGES.includes(parsed.stage)) {
                continue;
            }
            const document = registry.get(fqn);
            if (!document) {
                continue;
            }
            const sequence = getSequence(document.block);
            if (sequence !== undefined && sequence > max) {
                max = sequence;
            }
        }
        return max + 1;
    }
}
//# sourceMappingURL=sequence.js.map