"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, MoreHorizontal, Loader2, Pencil, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  createdAt: string;
}

const stageColors: Record<string, string> = {
  QUALIFICATION: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  NEEDS_ANALYSIS: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  PROPOSAL: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  NEGOTIATION: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  CLOSED_WON: "bg-green-500/10 text-green-500 border-green-500/20",
  CLOSED_LOST: "bg-red-500/10 text-red-500 border-red-500/20",
};

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

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState(initialFormData);

  const fetchDeals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);

      const response = await fetch(`/api/deals?${params}`);
      if (response.ok) {
        const data = await response.json();
        setDeals(data.data);
      }
    } catch {
      toast.error("Erro ao carregar negócios");
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

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

  const openNewDialog = () => {
    setSelectedDeal(null);
    setFormData(initialFormData);
    setIsOpen(true);
  };

  const totalValue = deals.reduce((acc, deal) => acc + Number(deal.value), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Negócios</h1>
          <p className="text-muted-foreground">
            Valor total no pipeline: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/pipeline">Ver Pipeline</Link>
          </Button>
          <Button onClick={openNewDialog} className="bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300 dark:text-black">
            <Plus className="mr-2 h-4 w-4" />
            Novo Negócio
          </Button>
        </div>
      </div>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar negócios..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-black/10 to-gray-200 dark:from-white/10 dark:to-gray-800 flex items-center justify-center mb-4">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold">Nenhum negócio cadastrado</h3>
              <p className="text-sm text-muted-foreground">Comece adicionando seu primeiro negócio.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Probabilidade</TableHead>
                  <TableHead>Previsão</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((deal) => (
                  <TableRow key={deal.id}>
                    <TableCell className="font-medium">{deal.title}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(deal.value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={stageColors[deal.stage]}>
                        {stageLabels[deal.stage]}
                      </Badge>
                    </TableCell>
                    <TableCell>{deal.probability}%</TableCell>
                    <TableCell>
                      {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString("pt-BR") : "-"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                      {Object.entries(stageLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
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
