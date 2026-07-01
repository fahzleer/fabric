import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  // Isolated inputs have no surrounding <label>; give them an accessible name
  // so axe (WCAG "label") passes. Individual stories inherit this.
  args: { "aria-label": "Text input" },
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

// State matrix — the static-renderable states an Input can take. Hover/focus-visible
// are pointer/keyboard-driven (see the focus-visible:ring-ring in the component);
// default, filled, disabled, and error (border-destructive + aria-invalid) render here.
export const AllStates: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <Input aria-label="Default" placeholder="Default" />
      <Input aria-label="Filled" defaultValue="Filled value" />
      <Input aria-label="Disabled" placeholder="Disabled" disabled />
      <Input
        aria-label="Error"
        aria-invalid="true"
        defaultValue="Invalid value"
        className="border-destructive focus-visible:ring-destructive"
      />
    </div>
  ),
};
