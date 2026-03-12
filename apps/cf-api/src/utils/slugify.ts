export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\u0020-\u007E]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
