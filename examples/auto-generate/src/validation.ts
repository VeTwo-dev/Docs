import { z } from "zod";

export type Schema<T> = z.ZodType<T>;

export function validate<T>(
  schema: z.ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: z.ZodError } {
  return schema.safeParse(data);
}

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}
