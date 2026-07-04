import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card content area.</p>
      </CardContent>
      <CardFooter>
        <Button size="sm">Action</Button>
      </CardFooter>
    </Card>
  ),
};

export const WithCustomClassName: Story = {
  render: () => (
    <Card className="w-80 bg-secondary">
      <CardContent>
        <p>Custom className applied.</p>
      </CardContent>
    </Card>
  ),
};

// State matrix — Card itself is a static container (no hover/focus/disabled of
// its own); "states" here means how it's used: at rest, and as an interactive
// surface (the pattern product-card.tsx applies manually via hover/shadow
// utilities, since a clickable <Card> would need to render as a <Link> root).
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Card className="w-64">
        <CardHeader>
          <CardTitle>Default</CardTitle>
          <CardDescription>Resting state.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Static container — no interaction.</p>
        </CardContent>
      </Card>
      <Card className="w-64 shadow-md transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>Interactive</CardTitle>
          <CardDescription>Hover-elevated (shadow-md).</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Same pattern product-card.tsx uses on hover.</p>
        </CardContent>
      </Card>
    </div>
  ),
};
