export interface Builder {
  readonly name: string;
  readonly build: () => Promise<void>;
}

export { build as createBuilder } from "../engine/index.js";
