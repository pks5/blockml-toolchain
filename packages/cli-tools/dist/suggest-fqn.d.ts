export interface SuggestFqnOptions {
    rootDir: string;
    srcDir?: string;
    libraries?: string[];
}
export declare function suggestMatchingFqn(unknownFqn: string, options: SuggestFqnOptions): Promise<string | undefined>;
export declare function unknownFqnMessage(fqn: string, suggestion?: string): string;
//# sourceMappingURL=suggest-fqn.d.ts.map