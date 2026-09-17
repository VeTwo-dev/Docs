import { describe, it, expect } from "vitest";
import { extractStories, createStorybookExampleExtractor } from "./index.js";

const STORIES = `import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta = {
  title: "Button",
  component: Button,
} satisfies Meta<typeof Button>;

export const Primary: StoryObj<typeof meta> = {
  args: { variant: "primary", children: "Click me" },
};

export const Secondary = (args) => {
  return <Button {...args} variant="secondary" />;
};
`;

describe("extractStories", () => {
  it("extracts story exports with component context", () => {
    const stories = extractStories(STORIES);
    expect(stories).toHaveLength(2);
    expect(stories[0]?.name).toBe("Primary");
    expect(stories[0]?.meta).toBe("Button");
    expect(stories[1]?.name).toBe("Secondary");
  });
});

describe("createStorybookExampleExtractor", () => {
  const extractor = createStorybookExampleExtractor();

  it("supports storybook files only", () => {
    expect(extractor.supports("src/Button.stories.tsx")).toBe(true);
    expect(extractor.supports("src/Button.story.js")).toBe(true);
    expect(extractor.supports("src/Button.tsx")).toBe(false);
  });

  it("produces storybook provenance and demo type hint", () => {
    const raw = extractor.extract({ path: "src/Button.stories.tsx", content: STORIES });
    expect(raw[0]?.provenance.kind).toBe("storybook");
    expect(raw[0]?.typeHint).toBe("demo");
    expect(raw[0]?.framework).toBe("storybook");
  });
});
