let counter = 0;

/** Creates a collision-resistant local identifier without adding a dependency. */
export function createLocalId(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000;
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${time}-${counter.toString(36)}-${random}`;
}
