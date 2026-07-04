import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta: Meta = {
  title: "UI/Tabs",
  tags: ["autodocs"],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="account" className="w-96">
      <TabsList>
        <TabsTrigger value="account">Account</TabsTrigger>
        <TabsTrigger value="password">Password</TabsTrigger>
      </TabsList>
      <TabsContent value="account">Make changes to your account here.</TabsContent>
      <TabsContent value="password">Change your password here.</TabsContent>
    </Tabs>
  ),
};

export const ThreeTabs: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-96">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="applications">Applications</TabsTrigger>
        <TabsTrigger value="payouts">Payouts</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Overview content</TabsContent>
      <TabsContent value="applications">Applications content</TabsContent>
      <TabsContent value="payouts">Payouts content</TabsContent>
    </Tabs>
  ),
};

export const WithDisabledTab: Story = {
  render: () => (
    <Tabs defaultValue="active" className="w-96">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="locked" disabled>
          Locked
        </TabsTrigger>
      </TabsList>
      <TabsContent value="active">Active content</TabsContent>
      <TabsContent value="locked">Locked content</TabsContent>
    </Tabs>
  ),
};
