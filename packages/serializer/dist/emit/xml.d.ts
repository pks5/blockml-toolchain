import type { XmlTrivia } from "@blockml/bom";
export declare class XmlWriter {
    private indent;
    private parts;
    private depth;
    constructor(indent: number);
    line(raw?: string): void;
    blank(): void;
    pushDepth(): void;
    popDepth(): void;
    comments(trivia: XmlTrivia | undefined, trailing?: boolean): void;
    toString(): string;
}
export declare function escapeAttr(value: string): string;
export declare function escapeText(value: string): string;
export declare function needsCData(text: string): boolean;
export declare function emitCharacterData(writer: XmlWriter, text: string, form?: "text" | "cdata"): void;
export declare function formatBoolean(value: boolean): string;
export declare function formatMemberValue(value: unknown): string;
//# sourceMappingURL=xml.d.ts.map