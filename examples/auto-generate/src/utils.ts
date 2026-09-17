export interface FormatOptions {
  locale?: string;
  timezone?: string;
}

export function formatDate(date: Date, options?: FormatOptions): string {
  return new Intl.DateTimeFormat(options?.locale ?? "en-US", {
    timeZone: options?.timezone,
  }).format(date);
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
