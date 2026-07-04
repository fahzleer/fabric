import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertTriangle, CheckCircle2, Info as InfoIcon, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./alert";

const meta: Meta<typeof Alert> = {
  title: "UI/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["info", "success", "warning", "destructive"] },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {
  render: () => (
    <Alert variant="info" className="max-w-md">
      <InfoIcon />
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>Your order will ship within 2 business days.</AlertDescription>
    </Alert>
  ),
};

export const Success: Story = {
  render: () => (
    <Alert variant="success" className="max-w-md">
      <CheckCircle2 />
      <AlertTitle>Payment received</AlertTitle>
      <AlertDescription>We&apos;ve confirmed your payment.</AlertDescription>
    </Alert>
  ),
};

export const Warning: Story = {
  render: () => (
    <Alert variant="warning" className="max-w-md">
      <AlertTriangle />
      <AlertTitle>Low stock</AlertTitle>
      <AlertDescription>Only 2 items left for this option.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" className="max-w-md">
      <XCircle />
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription>Your card was declined. Please try another method.</AlertDescription>
    </Alert>
  ),
};
