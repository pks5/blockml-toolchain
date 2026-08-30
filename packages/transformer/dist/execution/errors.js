export class TransformError extends Error {
    kind;
    constructor(kind, message) {
        super(message);
        this.name = "TransformError";
        this.kind = kind;
    }
    get exitCode() {
        return this.kind === "execution" ? 1 : 2;
    }
}
//# sourceMappingURL=errors.js.map