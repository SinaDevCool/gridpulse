export type OperatorBounds = [number, number, number, number];

export function operatorBoundsIntersect(left: OperatorBounds, right: OperatorBounds) {
  return left[0] <= right[2] && left[2] >= right[0] && left[1] <= right[3] && left[3] >= right[1];
}

export function mergeOperatorBounds(
  left: OperatorBounds | null,
  right: OperatorBounds | null,
): OperatorBounds | null {
  if (!left) return right;
  if (!right) return left;
  return [
    Math.min(left[0], right[0]),
    Math.min(left[1], right[1]),
    Math.max(left[2], right[2]),
    Math.max(left[3], right[3]),
  ];
}
