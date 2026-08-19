export type Visibility = "private" | "protected" | "public";
export declare function parseVisibilityFromName(localName: string): {
    name: string;
    visibility: Visibility;
};
export declare function visibilityPrefix(visibility: Visibility | undefined): string;
//# sourceMappingURL=visibility.d.ts.map