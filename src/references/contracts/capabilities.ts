/**
 * Universal reference resolver capabilities.
 *
 * Capabilities describe which binding features a resolver recovers from the
 * normalized syntax trees. The engine never inspects native nodes; it only
 * reads what a resolver declares.
 */
export const REFERENCE_RESOLVER_CAPABILITIES = [
  "import-bindings",
  "export-aliases",
  "default-imports",
  "namespace-imports",
  "re-exports",
] as const;

/** A known reference resolver capability. */
export type ReferenceCapabilityName = (typeof REFERENCE_RESOLVER_CAPABILITIES)[number];

/** The support level for a capability. */
export type ReferenceCapabilityValue = "none" | "basic" | "full";

/** The capability set a {@link ReferenceResolver} declares. */
export type ReferenceResolverCapabilities = Readonly<
  Partial<Record<ReferenceCapabilityName, ReferenceCapabilityValue>>
>;

/** Whether `name` is a known reference capability. */
export function isKnownReferenceCapability(name: string): name is ReferenceCapabilityName {
  return (REFERENCE_RESOLVER_CAPABILITIES as readonly string[]).includes(name);
}
