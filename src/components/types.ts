/** A registered MDX component with metadata. */
export interface MdxComponent {
  readonly name: string;
  readonly description: string;
  readonly render: (props: Record<string, string>, children: string) => string;
}

/** Input for registering a custom MDX component. */
export interface MdxComponentInput {
  readonly name: string;
  readonly description?: string;
  readonly render: (props: Record<string, string>, children: string) => string;
}
