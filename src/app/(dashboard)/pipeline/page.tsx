"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Link from "next/link";

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability: number;
  expectedCloseDate: string | null;
  description: string | null;
  contact: { name: string } | null;
  company: { name: string } | null;
}

const stages = [
  { id: "QUALIFICATION", label: "Qualificação", color: "bg-gray-500" },
  { id: "NEEDS_ANALYSIS", label: "Análise", color: "bg-blue-500" },
  { id: "PROPOSAL", label: "Proposta", color: "bg-purple-500" },
  { id: "NEGOTIATION", label: "Negociação", color: "bg-orange-500" },
  { id: "CLOSED_WON", label: "Ganho", color: "bg-green-500" },
  { id: "CLOSED_LOST", label: "Perdido", color: "bg-red-500" },
];

const stageLabels: Record<string, string> = {
  QUALIFICATION: "Qualificação",
  NEEDS_ANALYSIS: "Análise",
  PROPOSAL: "Proposta",
  NEGOTIATION: "Negociação",
  CLOSED_WON: "Ganho",
  CLOSED_LOST: "Perdido",
};

const initialFormData = {
  title: "",
  value: "",
  stage: "QUALIFICATION",
  probability: "20",
  expectedCloseDate: "",
  description: "",
};

export default function PipelinePage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);

  const fetchDeals = useCallback(async () => {
    try {
      const response = await fetch("/api/deals?limit=100");
      if (response.ok) {
        const data = await response.json();
        setDeals(data.data);
      }
    } catch {
      toast.error("Erro ao carregar negócios");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    if (!draggedDeal || draggedDeal.stage === newStage) {
      setDraggedDeal(null);
      return;
    }

    try {
      const response = await fetch(`/api/deals/${draggedDeal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!response.ok) throw new Error("Erro ao mover negócio");

      setDeals((prev) =>
        prev.map((deal) =>
          deal.id === draggedDeal.id ? { ...deal, stage: newStage } : deal
        )
      );
      toast.success(`Negócio movido para ${stageLabels[newStage]}`);
    } catch {
      toast.error("Erro ao mover negócio");
    } finally {
      setDraggedDeal(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = selectedDeal ? `/api/deals/${selectedDeal.id}` : "/api/deals";
      const method = selectedDeal ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          value: Number(formData.value),
          probability: Number(formData.probability),
          expectedCloseDate: formData.expectedCloseDate ? new Date(formData.expectedCloseDate).toISOString() : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success(selectedDeal ? "Negócio atualizado!" : "Negócio criado!");
      setIsOpen(false);
      setFormData(initialFormData);
      setSelectedDeal(null);
      fetchDeals();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar negócio");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (deal: Deal) => {
    setSelectedDeal(deal);
    setFormData({
      title: deal.title,
      value: deal.value.toString(),
      stage: deal.stage,
      probability: deal.probability.toString(),
      expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split("T")[0] : "",
      description: deal.description || "",
    });
    setIsOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedDeal) return;

    try {
      const response = await fetch(`/api/deals/${selectedDeal.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Erro ao excluir negócio");

      toast.success("Negócio excluído!");
      setIsDeleteOpen(false);
      setSelectedDeal(null);
      fetchDeals();
    } catch {
      toast.error("Erro ao excluir negócio");
    }
  };

  const openNewDialog = (stage?: string) => {
    setSelectedDeal(null);
    setFormData({ ...initialFormData, stage: stage || "QUALIFICATION" });
    setIsOpen(true);
  };

  const getDealsForStage = (stageId: string) => {
    return deals.filter((deal) => deal.stage === stageId);
  };

  const getTotalForStage = (stageId: string) => {
    return getDealsForStage(stageId).reduce((acc, deal) => acc + Number(deal.value), 0);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipeline</h1>
          <p className="text-muted-foreground">
            Arraste os negócios entre as colunas para atualizar o estágio.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/deals">Ver Lista</Link>
          </Button>
          <Button onClick={() => openNewDialog()} className="bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300 dark:text-black">
            <Plus className="mr-2 h-4 w-4" />
            Novo Negócio
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="w-[300px] flex-shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                      <CardTitle className="text-sm font-medium">
                        {stage.label}
                      </CardTitle>
                      <Badge variant="secondary" className="ml-1">
                        {getDealsForStage(stage.id).length}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openNewDialog(stage.id)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(getTotalForStage(stage.id))}
                  </p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {getDealsForStage(stage.id).map((deal) => (
                    <Card
                      key={deal.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, deal)}
                      className={`cursor-grab active:cursor-grabbing border-border/40 hover:border-border transition-colors ${
                        draggedDeal?.id === deal.id ? "opacity-50" : ""
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-medium truncate">{deal.title}</h4>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0">
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEdit(deal)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSelectedDeal(deal); setIsDeleteOpen(true); }} className="text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <p className="text-sm font-semibold text-primary mt-1">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deal.value)}
                            </p>
                            {deal.company && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {deal.company.name}
                              </p>
                            )}
                            {deal.expectedCloseDate && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Previsão: {new Date(deal.expectedCloseDate).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {getDealsForStage(stage.id).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Arraste negócios aqui
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDeal ? "Editar Negócio" : "Novo Negócio"}</DialogTitle>
            <DialogDescription>Preencha as informações do negócio.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título *</Label>
                <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="value">Valor *</Label>
                  <Input id="value" type="number" step="0.01" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="probability">Probabilidade (%)</Label>
                  <Input id="probability" type="number" min="0" max="100" value={formData.probability} onChange={(e) => setFormData({ ...formData, probability: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="stage">Estágio</Label>
                  <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="expectedCloseDate">Previsão de fechamento</Label>
                  <Input id="expectedCloseDate" type="date" value={formData.expectedCloseDate} onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedDeal ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Negócio</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir &quot;{selectedDeal?.title}&quot;?</DialogDescription>
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
