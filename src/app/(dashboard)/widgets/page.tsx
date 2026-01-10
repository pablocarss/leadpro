"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, MoreHorizontal, Loader2, Pencil, Trash2, Code, Globe, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Widget {
  id: string;
  name: string;
  primaryColor: string;
  position: string;
  welcomeMessage: string;
  allowedDomains: string[];
  isActive: boolean;
  createdAt: string;
  _count: {
    sessions: number;
  };
}

const initialFormData = {
  name: "",
  primaryColor: "#3B82F6",
  position: "right",
  welcomeMessage: "Olá! Como posso ajudar?",
  allowedDomains: "",
  isActive: true,
};

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [copied, setCopied] = useState(false);

  const fetchWidgets = useCallback(async () => {
    try {
      const response = await fetch("/api/widgets");
      if (response.ok) {
        const data = await response.json();
        setWidgets(data.data);
      }
    } catch {
      toast.error("Erro ao carregar widgets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWidgets();
  }, [fetchWidgets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = selectedWidget ? `/api/widgets/${selectedWidget.id}` : "/api/widgets";
      const method = selectedWidget ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          allowedDomains: formData.allowedDomains
            ? formData.allowedDomains.split("\n").map((d) => d.trim()).filter(Boolean)
            : [],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success(selectedWidget ? "Widget atualizado!" : "Widget criado!");
      setIsOpen(false);
      setFormData(initialFormData);
      setSelectedWidget(null);
      fetchWidgets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar widget");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (widget: Widget) => {
    setSelectedWidget(widget);
    setFormData({
      name: widget.name,
      primaryColor: widget.primaryColor,
      position: widget.position,
      welcomeMessage: widget.welcomeMessage,
      allowedDomains: widget.allowedDomains.join("\n"),
      isActive: widget.isActive,
    });
    setIsOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedWidget) return;

    try {
      const response = await fetch(`/api/widgets/${selectedWidget.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Erro ao excluir widget");

      toast.success("Widget excluído!");
      setIsDeleteOpen(false);
      setSelectedWidget(null);
      fetchWidgets();
    } catch {
      toast.error("Erro ao excluir widget");
    }
  };

  const openNewDialog = () => {
    setSelectedWidget(null);
    setFormData(initialFormData);
    setIsOpen(true);
  };

  const openCodeDialog = (widget: Widget) => {
    setSelectedWidget(widget);
    setIsCodeOpen(true);
    setCopied(false);
  };

  const getEmbedCode = (widget: Widget) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `<script src="${baseUrl}/widget/leadpro-chat.js" data-widget-id="${widget.id}"></script>`;
  };

  const copyCode = () => {
    if (!selectedWidget) return;
    navigator.clipboard.writeText(getEmbedCode(selectedWidget));
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Chat Widgets</h1>
          <p className="text-muted-foreground">
            Crie widgets de chat para seus sites
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300 dark:text-black">
          <Plus className="mr-2 h-4 w-4" />
          Novo Widget
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : widgets.length === 0 ? (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-black/10 to-gray-200 dark:from-white/10 dark:to-gray-800 flex items-center justify-center mb-4">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Nenhum widget criado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie um widget para adicionar chat ao seu site.
            </p>
            <Button onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Widget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {widgets.map((widget) => (
            <Card key={widget.id} className="border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${widget.primaryColor}20` }}
                    >
                      <Globe className="h-5 w-5" style={{ color: widget.primaryColor }} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{widget.name}</CardTitle>
                      <CardDescription>
                        {widget._count.sessions} conversas
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openCodeDialog(widget)}>
                        <Code className="mr-2 h-4 w-4" />
                        Código de Embed
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(widget)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { setSelectedWidget(widget); setIsDeleteOpen(true); }}
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
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={widget.isActive ? "default" : "secondary"}>
                    {widget.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                  <Badge variant="outline">
                    {widget.position === "right" ? "Direita" : "Esquerda"}
                  </Badge>
                </div>
                <Button variant="outline" className="w-full" onClick={() => openCodeDialog(widget)}>
                  <Code className="mr-2 h-4 w-4" />
                  Ver Código
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Criar/Editar Widget */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedWidget ? "Editar Widget" : "Novo Widget"}</DialogTitle>
            <DialogDescription>
              Configure o widget de chat para seu site.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Chat do Site Principal"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="primaryColor">Cor</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="position">Posição</Label>
                  <Select
                    value={formData.position}
                    onValueChange={(value) => setFormData({ ...formData, position: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="right">Direita</SelectItem>
                      <SelectItem value="left">Esquerda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="welcomeMessage">Mensagem de Boas-vindas</Label>
                <Textarea
                  id="welcomeMessage"
                  value={formData.welcomeMessage}
                  onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                  placeholder="Olá! Como posso ajudar?"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="allowedDomains">Domínios Permitidos</Label>
                <Textarea
                  id="allowedDomains"
                  value={formData.allowedDomains}
                  onChange={(e) => setFormData({ ...formData, allowedDomains: e.target.value })}
                  placeholder="exemplo.com.br&#10;app.exemplo.com&#10;(um por linha, vazio = todos)"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para permitir todos os domínios
                </p>
              </div>
              {selectedWidget && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="isActive">Widget Ativo</Label>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedWidget ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Código de Embed */}
      <Dialog open={isCodeOpen} onOpenChange={setIsCodeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Código de Embed</DialogTitle>
            <DialogDescription>
              Copie e cole este código no seu site, antes do fechamento da tag &lt;/body&gt;.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="relative">
              <pre className="bg-accent p-4 rounded-lg text-sm overflow-x-auto">
                <code>{selectedWidget && getEmbedCode(selectedWidget)}</code>
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={copyCode}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsCodeOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Excluir */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Widget</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir &quot;{selectedWidget?.name}&quot;?
              Todas as conversas deste widget serão excluídas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
