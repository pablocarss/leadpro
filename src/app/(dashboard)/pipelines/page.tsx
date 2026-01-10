"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, MoreHorizontal, Loader2, Pencil, Trash2, GitBranch, Eye, Star } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import Link from "next/link";

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  _count: {
    leads: number;
    stages: number;
  };
}

const initialFormData = {
  name: "",
  description: "",
  color: "#3B82F6",
  isDefault: false,
};

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [formData, setFormData] = useState(initialFormData);

  const fetchPipelines = useCallback(async () => {
    try {
      const response = await fetch("/api/pipelines");
      if (response.ok) {
        const data = await response.json();
        setPipelines(data.data);
      }
    } catch {
      toast.error("Erro ao carregar pipelines");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = selectedPipeline ? `/api/pipelines/${selectedPipeline.id}` : "/api/pipelines";
      const method = selectedPipeline ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success(selectedPipeline ? "Pipeline atualizada!" : "Pipeline criada!");
      setIsOpen(false);
      setFormData(initialFormData);
      setSelectedPipeline(null);
      fetchPipelines();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar pipeline");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setFormData({
      name: pipeline.name,
      description: pipeline.description || "",
      color: pipeline.color,
      isDefault: pipeline.isDefault,
    });
    setIsOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedPipeline) return;

    try {
      const response = await fetch(`/api/pipelines/${selectedPipeline.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Erro ao excluir pipeline");

      toast.success("Pipeline excluída!");
      setIsDeleteOpen(false);
      setSelectedPipeline(null);
      fetchPipelines();
    } catch {
      toast.error("Erro ao excluir pipeline");
    }
  };

  const openNewDialog = () => {
    setSelectedPipeline(null);
    setFormData(initialFormData);
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipelines</h1>
          <p className="text-muted-foreground">
            Gerencie suas pipelines de vendas
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300 dark:text-black">
          <Plus className="mr-2 h-4 w-4" />
          Nova Pipeline
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pipelines.length === 0 ? (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-black/10 to-gray-200 dark:from-white/10 dark:to-gray-800 flex items-center justify-center mb-4">
              <GitBranch className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Nenhuma pipeline cadastrada</h3>
            <p className="text-sm text-muted-foreground mb-4">Crie sua primeira pipeline para organizar seus leads.</p>
            <Button onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Pipeline
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((pipeline) => (
            <Card key={pipeline.id} className="border-border/40 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${pipeline.color}20` }}
                    >
                      <GitBranch className="h-5 w-5" style={{ color: pipeline.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                        {pipeline.isDefault && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <CardDescription className="line-clamp-1">
                        {pipeline.description || "Sem descrição"}
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
                      <DropdownMenuItem asChild>
                        <Link href={`/pipelines/${pipeline.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ver Pipeline
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(pipeline)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { setSelectedPipeline(pipeline); setIsDeleteOpen(true); }}
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
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">
                    {pipeline._count.stages} estágios
                  </Badge>
                  <Badge variant="outline">
                    {pipeline._count.leads} leads
                  </Badge>
                </div>
                <div className="mt-4">
                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/pipelines/${pipeline.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Abrir Pipeline
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPipeline ? "Editar Pipeline" : "Nova Pipeline"}</DialogTitle>
            <DialogDescription>
              {selectedPipeline
                ? "Atualize as informações da pipeline."
                : "Crie uma nova pipeline com estágios padrão."}
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
                  placeholder="Ex: Pipeline de Vendas"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o objetivo desta pipeline"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">Cor</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    placeholder="#3B82F6"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="isDefault">Pipeline Padrão</Label>
                  <p className="text-sm text-muted-foreground">
                    Define como a pipeline principal
                  </p>
                </div>
                <Switch
                  id="isDefault"
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedPipeline ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Pipeline</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir &quot;{selectedPipeline?.name}&quot;?
              Todos os leads desta pipeline serão excluídos.
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
