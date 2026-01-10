"use client";

import { Target, Users, Building2, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  {
    title: "Total de Leads",
    value: "0",
    icon: Target,
    description: "Novos leads este mês",
  },
  {
    title: "Contatos",
    value: "0",
    icon: Users,
    description: "Contatos ativos",
  },
  {
    title: "Empresas",
    value: "0",
    icon: Building2,
    description: "Empresas cadastradas",
  },
  {
    title: "Negócios",
    value: "R$ 0",
    icon: TrendingUp,
    description: "Valor total em pipeline",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Bem-vindo ao LeadPro. Gerencie seus leads e negócios.
        </p>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className="h-7 w-7 md:h-8 md:w-8 rounded-lg bg-gradient-to-br from-black to-gray-600 dark:from-white dark:to-gray-400 flex items-center justify-center flex-shrink-0">
                <stat.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-white dark:text-black" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Leads Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nenhum lead cadastrado ainda. Comece adicionando seu primeiro lead.
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Tarefas Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nenhuma tarefa pendente. Suas tarefas aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
