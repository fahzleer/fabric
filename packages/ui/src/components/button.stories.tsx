import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "success",
        "info",
        "warning",
        "outline",
        "secondary",
        "ghost",
        "link",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    loading: { control: "boolean" },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Button" } };
export const Destructive: Story = { args: { children: "Delete", variant: "destructive" } };
export const Outline: Story = { args: { children: "Outline", variant: "outline" } };
export const Secondary: Story = { args: { children: "Secondary", variant: "secondary" } };
export const Ghost: Story = { args: { children: "Ghost", variant: "ghost" } };
export const Link: Story = { args: { children: "Link", variant: "link" } };

export const SizeSmall: Story = { args: { children: "Small", size: "sm" } };
export const SizeLarge: Story = { args: { children: "Large", size: "lg" } };
export const SizeIcon: Story = { args: { children: "★", size: "icon" } };

export const Disabled: Story = { args: { children: "Disabled", disabled: true } };
export const Loading: Story = { args: { children: "Saving", loading: true } };
export const WithClassName: Story = { args: { children: "Custom", className: "w-full" } };

export const AsChildLink: Story = {
  render: () => (
    <Button asChild>
      <a href="/home">Link Button</a>
    </Button>
  ),
};

// Functional variants added on top of shadcn's defaults (DESIGN.md §7.2).
export const Success: Story = { args: { children: "Approve", variant: "success" } };
export const Info: Story = { args: { children: "Details", variant: "info" } };
export const Warning: Story = { args: { children: "Review", variant: "warning" } };

// State matrix — the canonical reference for the interactive states a button can
// take. Hover/focus-visible/active are pointer/keyboard-driven; default,
// disabled, and loading are rendered here. Pair with the a11y + visual snapshots.
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(
        ["default", "destructive", "success", "info", "warning", "outline", "secondary"] as const
      ).map((variant) => (
        <div key={variant} className="flex items-center gap-3">
          <Button variant={variant}>Default</Button>
          <Button variant={variant} disabled>
            Disabled
          </Button>
          <Button variant={variant} loading>
            Loading
          </Button>
        </div>
      ))}
    </div>
  ),
};
