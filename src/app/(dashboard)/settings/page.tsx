"use client";

import Link from "next/link";
import { User, Plug, Bell, Shield, Palette } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const settingsItems = [
  {
    title: "Meu Perfil",
    description: "Gerencie suas informações pessoais e senha",
    icon: User,
    href: "/profile",
  },
  {
    title: "Integrações",
    description: "Conecte WhatsApp, Email e outras ferramentas",
    icon: Plug,
    href: "/integrations",
  },
  {
    title: "Notificações",
    description: "Configure suas preferências de notificação",
    icon: Bell,
    href: "/settings/notifications",
    disabled: true,
  },
  {
    title: "Segurança",
    description: "Autenticação de dois fatores e sessões ativas",
    icon: Shield,
    href: "/settings/security",
    disabled: true,
  },
  {
    title: "Aparência",
    description: "Personalize o tema e a interface",
    icon: Palette,
    href: "/settings/appearance",
    disabled: true,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Gerencie suas configurações e preferências.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {settingsItems.map((item) => (
          <Link
            key={item.title}
            href={item.disabled ? "#" : item.href}
            className={item.disabled ? "cursor-not-allowed" : ""}
          >
            <Card
              className={`border-border/40 bg-card/50 backdrop-blur-sm h-full transition-colors ${
                item.disabled
                  ? "opacity-50"
                  : "hover:bg-accent/50 hover:border-border"
              }`}
            >
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-black to-gray-600 dark:from-white dark:to-gray-400 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-white dark:text-black" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              {item.disabled && (
                <CardContent className="pt-0">
                  <span className="text-xs text-muted-foreground">Em breve</span>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
