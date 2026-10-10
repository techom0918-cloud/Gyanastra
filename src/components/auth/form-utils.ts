// Moves keyboard focus to the first invalid field after a failed submit (so screen-reader and keyboard users land on
// the problem, not at the top of the page). `ids` maps field names to the ids of their inputs.
export function focusFirstError(errors: Record<string, string>, ids: Record<string, string>): void {
  const field = Object.keys(ids).find((name) => errors[name]);
  if (!field) return;
  // Wait for React to render the error state before focusing.
  requestAnimationFrame(() => document.getElementById(ids[field])?.focus());
}
