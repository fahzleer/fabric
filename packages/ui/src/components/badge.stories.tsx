import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Badge" } };
export const Secondary: Story = { args: { children: "Secondary", variant: "secondary" } };
export const Destructive: Story = { args: { children: "Destructive", variant: "destructive" } };
export const Outline: Story = { args: { children: "Outline", variant: "outline" } };
export const WithCustomClass: Story = {
  args: { children: "Custom", className: "text-purple-600" },
};

// Soft status tones (DESIGN.md §7.2) — the canonical status-pill variants,
// e.g. account/orders. Previously had zero story/e2e/test coverage.
export const Success: Story = { args: { children: "Success", variant: "success" } };
export const Warning: Story = { args: { children: "Warning", variant: "warning" } };
export const Info: Story = { args: { children: "Info", variant: "info" } };
export const Danger: Story = { args: { children: "Danger", variant: "danger" } };
export const Neutral: Story = { args: { children: "Neutral", variant: "neutral" } };

// State matrix — the canonical reference for every Badge variant side by side.
// Badge is non-interactive (no hover/active/disabled), so "states" here means
// the full variant set rather than pointer/keyboard states.
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      {(
        [
          "default",
          "secondary",
          "destructive",
          "outline",
          "success",
          "warning",
          "info",
          "danger",
          "neutral",
        ] as const
      ).map((variant) => (
        <Badge key={variant} variant={variant}>
          {variant}
        </Badge>
      ))}
    </div>
  ),
};
