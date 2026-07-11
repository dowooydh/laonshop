export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}
