import type { Meta, StoryObj } from "@storybook/react-vite";
import { PackageOpen, ShoppingCart } from "lucide-react";
import { Button } from "./button";
import { EmptyState } from "./empty-state";

const meta: Meta<typeof EmptyState> = {
  title: "UI/Empty State",
  component: EmptyState,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    icon: <PackageOpen />,
    title: "No products found",
    description: "Try adjusting your filters or search terms.",
  },
};

export const WithAction: Story = {
  render: () => (
    <EmptyState
      icon={<ShoppingCart />}
      title="Your cart is empty"
      description="Browse the catalog to add items."
    >
      <Button>Shop products</Button>
    </EmptyState>
  ),
};

export const TitleOnly: Story = { args: { title: "Nothing here yet" } };
