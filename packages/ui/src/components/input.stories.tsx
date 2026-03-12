import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { placeholder: "Enter text..." } };
export const WithType: Story = { args: { type: "email", placeholder: "email@example.com" } };
export const Password: Story = { args: { type: "password", placeholder: "Password" } };
export const Disabled: Story = { args: { placeholder: "Disabled", disabled: true } };
export const WithValue: Story = { args: { defaultValue: "Prefilled value" } };
export const WithClassName: Story = {
  args: { className: "border-red-500", placeholder: "Error state" },
};
