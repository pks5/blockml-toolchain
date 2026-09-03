export type ExpressionNode =
  | LiteralExpressionNode
  | ArrayExpressionNode
  | ObjectExpressionNode
  | PropertyExpressionNode
  | CallExpressionNode
  | BinaryExpressionNode
  | InterpolatedStringNode;

export interface BinaryExpressionNode {
  kind: "binary";
  operator: "+" | "-" | "*" | "/";
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface LiteralExpressionNode {
  kind: "literal";
  value: string | number | boolean | null;
}

export interface ArrayExpressionNode {
  kind: "array";
  elements: ExpressionNode[];
}

export interface ObjectExpressionNode {
  kind: "object";
  entries: Record<string, ExpressionNode>;
}

export interface PropertyExpressionNode {
  kind: "property";
  path: string[];
}

export interface CallExpressionNode {
  kind: "call";
  callee: string;
  args: ExpressionNode[];
}

export interface InterpolatedStringNode {
  kind: "interpolated";
  parts: ExpressionNode[];
}

export interface ParseExpressionResult {
  ast: ExpressionNode;
  resultTypeFqn?: string;
}

export interface ParseExpressionError {
  message: string;
  offset: number;
}

export type ParseExpressionOutcome =
  | { ok: true; result: ParseExpressionResult }
  | { ok: false; error: ParseExpressionError };
