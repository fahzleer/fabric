import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
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
export const WithClassName: Story = { args: { children: "Custom", className: "w-full" } };

export const AsChildLink: Story = {
  render: () => (
    <Button asChild>
      <a href="/home">Link Button</a>
    </Button>
  ),
};
