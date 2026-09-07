import type { Element } from "@xmldom/xmldom";
/** Legacy document root. Type identity comes from child `<type>`. */
export declare const V1_ROOT_ELEMENT = "block";
export declare function isDocumentRootLocalName(local: string): boolean;
export declare function assertBlockRoot(element: Element): void;
//# sourceMappingURL=root-type.d.ts.map