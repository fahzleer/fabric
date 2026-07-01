import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "./spinner";

const meta: Meta<typeof Spinner> = {
  title: "UI/Spinner",
  component: Spinner,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "select", options: ["sm", "default", "lg"] },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };

export const Showcase: Story = {
  render: () => (
    <div className="flex items-center gap-6 text-foreground">
      <Spinner size="sm" />
      <Spinner size="default" />
      <Spinner size="lg" />
    </div>
  ),
};
