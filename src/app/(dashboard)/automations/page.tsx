"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Bot,
  Play,
  Pause,
  Pencil,
  Trash2,
  MoreHorizontal,
  Zap,
  MessageCircle,
  GitBranch,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface WhatsappSession {
  id: string;
  name: string;
  phone: string | null;
  status: string;
}

interface Automation {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  trigger: string;
  triggerValue: string | null;
  whatsappSession: WhatsappSession | null;
  _count: { executions: number };
  createdAt: string;
}

const triggerLabels: Record<string, string> = {
  KEYWORD: "Palavra-chave",
  NEW_CONVERSATION: "Nova conversa",
  ALL_MESSAGES: "Todas mensagens",
  BUTTON_REPLY: "Resposta de botão",
  SCHEDULE: "Agendamento",
};

const triggerDescriptions: Record<string, string> = {
  KEYWORD: "Ativa quando uma palavra-chave específica é recebida",
  NEW_CONVERSATION: "Ativa quando uma nova conversa é iniciada",
  ALL_MESSAGES: "Ativa para todas as mensagens recebidas",
  BUTTON_REPLY: "Ativa quando o cliente clica em um botão",
  SCHEDULE: "Ativa em horários programados",
};

export default function AutomationsPage() {
  const router = useRouter();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [sessions, setSessions] = useState<WhatsappSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    trigger: "KEYWORD",
    triggerValue: "",
    whatsappSessionId: "",
  });

  const fetchAutomations = useCallback(async () => {
    try {
      const response = await fetch("/api/automations");
      if (response.ok) {
        const data = await response.json();
        setAutomations(data);
      }
    } catch {
      toast.error("Erro ao carregar automações");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp");
      if (response.ok) {
        const data = await response.json();
        const connected = Array.isArray(data)
          ? data.filter((s: WhatsappSession) => s.status === "CONNECTED")
          : [];
        setSessions(connected);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
    fetchSessions();
  }, [fetchAutomations, fetchSessions]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          whatsappSessionId: formData.whatsappSessionId || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      const automation = await response.json();
      toast.success("Automação criada!");
      setIsCreateOpen(false);
      setFormData({
        name: "",
        description: "",
        trigger: "KEYWORD",
        triggerValue: "",
        whatsappSessionId: "",
      });

      // Redirect to editor
      router.push(`/automations/${automation.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar automação");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (automation: Automation) => {
    try {
      const response = await fetch(`/api/automations/${automation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !automation.isActive }),
      });

      if (!response.ok) throw new Error("Erro ao atualizar");

      toast.success(automation.isActive ? "Automação pausada" : "Automação ativada");
      fetchAutomations();
    } catch {
      toast.error("Erro ao atualizar automação");
    }
  };

  const handleDelete = async () => {
    if (!selectedAutomation) return;

    try {
      const response = await fetch(`/api/automations/${selectedAutomation.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erro ao excluir");

      toast.success("Automação excluída!");
      setIsDeleteOpen(false);
      setSelectedAutomation(null);
      fetchAutomations();
    } catch {
      toast.error("Erro ao excluir automação");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/integrations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold">Automações</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Crie fluxos de atendimento automatizados.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300 dark:text-black"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Automação
        </Button>
      </div>

      {automations.length === 0 ? (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-purple-500" />
            </div>
            <h3 className="text-lg font-semibold">Nenhuma automação criada</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Crie fluxos de atendimento para automatizar respostas e interações com seus clientes.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira automação
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {automations.map((automation) => (
            <Card
              key={automation.id}
              className="border-border/40 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        automation.isActive
                          ? "bg-gradient-to-br from-green-500 to-green-600"
                          : "bg-gradient-to-br from-gray-500 to-gray-600"
                      }`}
                    >
                      <GitBranch className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{automation.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {triggerLabels[automation.trigger]}
                        {automation.triggerValue && `: "${automation.triggerValue}"`}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/automations/${automation.id}`)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar fluxo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(automation)}>
                        {automation.isActive ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pausar
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Ativar
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedAutomation(automation);
                          setIsDeleteOpen(true);
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {automation.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {automation.description}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={automation.isActive ? "default" : "secondary"}>
                      {automation.isActive ? (
                        <>
                          <Zap className="mr-1 h-3 w-3" />
                          Ativo
                        </>
                      ) : (
                        "Inativo"
                      )}
                    </Badge>
                    {automation.whatsappSession && (
                      <Badge variant="outline" className="text-green-600 border-green-600/30">
                        <MessageCircle className="mr-1 h-3 w-3" />
                        {automation.whatsappSession.name}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {automation._count.executions} execuções
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nova Automação</DialogTitle>
            <DialogDescription>Configure as informações básicas da automação.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Atendimento inicial"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o objetivo desta automação..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid gap-2">
                <Label>Gatilho</Label>
                <Select
                  value={formData.trigger}
                  onValueChange={(value) => setFormData({ ...formData, trigger: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(triggerLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        <div>
                          <span>{label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {triggerDescriptions[formData.trigger]}
                </p>
              </div>
              {formData.trigger === "KEYWORD" && (
                <div className="grid gap-2">
                  <Label htmlFor="triggerValue">Palavra-chave</Label>
                  <Input
                    id="triggerValue"
                    placeholder="Ex: menu, ajuda, oi"
                    value={formData.triggerValue}
                    onChange={(e) => setFormData({ ...formData, triggerValue: e.target.value })}
                  />
                </div>
              )}
              {sessions.length > 0 && (
                <div className="grid gap-2">
                  <Label>Conexão WhatsApp (opcional)</Label>
                  <Select
                    value={formData.whatsappSessionId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, whatsappSessionId: value === "none" ? "" : value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as conexões" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Todas as conexões</SelectItem>
                      {sessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          <div className="flex items-center gap-2">
                            <MessageCircle className="h-3 w-3 text-green-500" />
                            {session.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar e Editar Fluxo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Excluir Automação</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir &quot;{selectedAutomation?.name}&quot;? Esta ação não
              pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="w-full sm:w-auto">
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
