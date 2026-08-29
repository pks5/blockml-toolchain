export type TransformFailureKind = "resolve" | "execution";

export class TransformError extends Error {
  readonly kind: TransformFailureKind;

  constructor(kind: TransformFailureKind, message: string) {
    super(message);
    this.name = "TransformError";
    this.kind = kind;
  }

  get exitCode(): number {
    return this.kind === "resolve" ? 2 : 1;
  }
}
