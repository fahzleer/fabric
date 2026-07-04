import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { type DateRange, DateRangePicker, rangeForLastNDays } from "./date-range-picker";

const meta: Meta = {
  title: "UI/DateRangePicker",
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof meta>;

function Interactive({ initial }: { initial: DateRange }) {
  const [range, setRange] = useState(initial);
  return <DateRangePicker value={range} onChange={setRange} />;
}

export const Default: Story = {
  render: () => <Interactive initial={rangeForLastNDays(7)} />,
};

export const ThirtyDaysActive: Story = {
  render: () => <Interactive initial={rangeForLastNDays(30)} />,
};

export const CustomRange: Story = {
  render: () => <Interactive initial={{ from: "2026-01-01", to: "2026-01-15" }} />,
};
