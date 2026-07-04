import type { Preview } from "@storybook/react-vite";
import "../src/index.css";

// Storybook's own dark-canvas backdrop matches the app's `.dark` class
// default (see apps/web/src/app/layout.tsx) so components render against
// the same background they ship on, not Storybook's default white canvas.
const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [{ name: "dark", value: "#080808" }],
    },
  },
  decorators: [
    (Story) => {
      document.documentElement.classList.add("dark");
      return Story();
    },
  ],
};

export default preview;
