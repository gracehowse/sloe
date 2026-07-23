import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

const meta = {
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "App chrome sidebar kit (`SidebarProvider` + panels). Requires the provider; this story mounts a minimal shell for Chromatic, not a full app layout.",
      },
    },
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

function MiniShell({ defaultOpen = true }: { defaultOpen?: boolean }) {
  return (
    <SidebarProvider defaultOpen={defaultOpen} className="min-h-[280px]">
      <Sidebar collapsible="none" className="border-r">
        <SidebarHeader className="px-3 py-2 text-sm font-semibold">Suppr</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigate</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>Today</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>Recipes</SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>Plan</SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="text-sm text-muted-foreground">Main content</span>
        </header>
        <div className="p-4 text-sm text-muted-foreground">
          Sidebar is app chrome — compose with `SidebarProvider` at the layout root.
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const Default: Story = {
  render: () => <MiniShell />,
};

export const CollapsedTrigger: Story = {
  render: () => <MiniShell defaultOpen={false} />,
};
