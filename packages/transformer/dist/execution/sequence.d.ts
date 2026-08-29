import type { TypeRegistry } from "@blockml/framework";
/**
 * Assigns the next library-scoped execution sequence.
 *
 * Reads the highest `sequence` already present under
 * `<library>._transform.running` and `<library>._transform.completed`.
 * A file lock can wrap `nextSequence` later without changing callers.
 */
export declare class SequenceAllocator {
    nextSequence(libraryFqn: string, registry: TypeRegistry): number;
}
//# sourceMappingURL=sequence.d.ts.map