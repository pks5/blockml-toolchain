export type TransformFailureKind = "resolve" | "execution" | "busy";

export class TransformError extends Error {
  readonly kind: TransformFailureKind;

  constructor(kind: TransformFailureKind, message: string) {
    super(message);
    this.name = "TransformError";
    this.kind = kind;
  }

  get exitCode(): number {
    return this.kind === "execution" ? 1 : 2;
  }
}
