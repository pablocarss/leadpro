"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  Contact,
  Target,
  CheckSquare,
  Settings,
  LogOut,
  LayoutDashboard,
  Kanban,
  TrendingUp,
  Plug,
  MessageCircle,
  GitBranch,
  Inbox,
  Globe,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Caixa de Entrada",
    url: "/inbox",
    icon: Inbox,
  },
  {
    title: "Pipelines",
    url: "/pipelines",
    icon: GitBranch,
  },
  {
    title: "Pipeline",
    url: "/pipeline",
    icon: Kanban,
  },
  {
    title: "Leads",
    url: "/leads",
    icon: Target,
  },
  {
    title: "Negócios",
    url: "/deals",
    icon: TrendingUp,
  },
  {
    title: "Contatos",
    url: "/contacts",
    icon: Contact,
  },
  {
    title: "Empresas",
    url: "/companies",
    icon: Building2,
  },
  {
    title: "Tarefas",
    url: "/tasks",
    icon: CheckSquare,
  },
  {
    title: "Integrações",
    url: "/integrations",
    icon: Plug,
  },
  {
    title: "Widgets",
    url: "/widgets",
    icon: Globe,
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageCircle,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <Sidebar className="border-r border-border/40">
      <SidebarHeader className="border-b border-border/40 p-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-black to-gray-600 dark:from-white dark:to-gray-400 flex items-center justify-center">
            <span className="text-white dark:text-black font-bold text-lg">LP</span>
          </div>
          <span className="font-bold text-xl">LeadPro</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    className="transition-colors"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/settings"}
                  className="transition-colors"
                >
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Configurações</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-gradient-to-br from-black to-gray-600 dark:from-white dark:to-gray-400 text-white dark:text-black text-sm">
                U
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Usuário</span>
              <span className="text-xs text-muted-foreground">Admin</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
