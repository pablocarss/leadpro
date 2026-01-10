"use client";

import { useState, useEffect, useCallback, use } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Loader2, ArrowLeft, Settings, User, DollarSign, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

interface PipelineLead {
  id: string;
  title: string;
  value: number | null;
  notes: string | null;
  stageId: string;
  contact: Contact | null;
  createdAt: string;
}

interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  color: string;
  stages: PipelineStage[];
  leads: PipelineLead[];
}

interface LeadCardProps {
  lead: PipelineLead;
  onClick: () => void;
}

function LeadCard({ lead, onClick }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-card border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{lead.title}</h4>
          {lead.contact && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <User className="h-3 w-3" />
              <span className="truncate">{lead.contact.name}</span>
            </div>
          )}
          {lead.value && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-1">
              <DollarSign className="h-3 w-3" />
              <span>
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(lead.value)}
              </span>
            </div>
          )}
        </div>
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function LeadCardOverlay({ lead }: { lead: PipelineLead }) {
  return (
    <div className="bg-card border rounded-lg p-3 shadow-lg">
      <h4 className="font-medium text-sm">{lead.title}</h4>
      {lead.contact && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <User className="h-3 w-3" />
          <span>{lead.contact.name}</span>
        </div>
      )}
    </div>
  );
}

interface StageColumnProps {
  stage: PipelineStage;
  leads: PipelineLead[];
  onAddLead: () => void;
  onLeadClick: (lead: PipelineLead) => void;
}

function StageColumn({ stage, leads, onAddLead, onLeadClick }: StageColumnProps) {
  const totalValue = leads.reduce((acc, lead) => acc + (Number(lead.value) || 0), 0);

  return (
    <div className="flex-shrink-0 w-72">
      <Card className="h-full border-t-4" style={{ borderTopColor: stage.color }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {stage.name}
                <Badge variant="secondary" className="text-xs">
                  {leads.length}
                </Badge>
              </CardTitle>
              {totalValue > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(totalValue)}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onAddLead}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-[calc(100vh-320px)]">
            <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 pr-2" data-stage-id={stage.id}>
                {leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onClick={() => onLeadClick(lead)}
                  />
                ))}
                {leads.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Arraste leads para cá
                  </div>
                )}
              </div>
            </SortableContext>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

const initialLeadForm = {
  title: "",
  value: "",
  notes: "",
  stageId: "",
  contactId: "",
};

export default function PipelineKanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Dialogs
  const [isLeadOpen, setIsLeadOpen] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [leadForm, setLeadForm] = useState(initialLeadForm);
  const [moveReason, setMoveReason] = useState("");
  const [pendingMove, setPendingMove] = useState<{ leadId: string; toStageId: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchPipeline = useCallback(async () => {
    try {
      const response = await fetch(`/api/pipelines/${id}`);
      if (response.ok) {
        const data = await response.json();
        setPipeline(data);
      } else {
        toast.error("Pipeline não encontrada");
      }
    } catch {
      toast.error("Erro ao carregar pipeline");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchContacts = useCallback(async () => {
    try {
      const response = await fetch("/api/contacts?limit=100");
      if (response.ok) {
        const data = await response.json();
        setContacts(data.data);
      }
    } catch {
      console.error("Erro ao carregar contatos");
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
    fetchContacts();
  }, [fetchPipeline, fetchContacts]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !pipeline) return;

    const leadId = active.id as string;
    const lead = pipeline.leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Encontrar o estágio de destino
    let toStageId: string | null = null;

    // Verificar se soltou em cima de outro lead
    const overLead = pipeline.leads.find((l) => l.id === over.id);
    if (overLead) {
      toStageId = overLead.stageId;
    } else {
      // Verificar se soltou em cima de um estágio
      const overStage = pipeline.stages.find((s) => s.id === over.id);
      if (overStage) {
        toStageId = overStage.id;
      }
    }

    // Se não encontrou destino ou é o mesmo estágio, não fazer nada
    if (!toStageId || toStageId === lead.stageId) return;

    // Abrir modal de motivo
    setPendingMove({ leadId, toStageId });
    setMoveReason("");
    setIsMoveOpen(true);
  };

  const confirmMove = async () => {
    if (!pendingMove) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/pipelines/${id}/leads/${pendingMove.leadId}/move`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toStageId: pendingMove.toStageId,
            reason: moveReason || null,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success("Lead movido com sucesso!");
      setIsMoveOpen(false);
      setPendingMove(null);
      fetchPipeline();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao mover lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddLead = (stageId: string) => {
    setSelectedLead(null);
    setLeadForm({ ...initialLeadForm, stageId });
    setIsLeadOpen(true);
  };

  const handleLeadClick = (lead: PipelineLead) => {
    setSelectedLead(lead);
    setLeadForm({
      title: lead.title,
      value: lead.value?.toString() || "",
      notes: lead.notes || "",
      stageId: lead.stageId,
      contactId: lead.contact?.id || "",
    });
    setIsLeadOpen(true);
  };

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = selectedLead
        ? `/api/pipelines/${id}/leads/${selectedLead.id}`
        : `/api/pipelines/${id}/leads`;
      const method = selectedLead ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: leadForm.title,
          stageId: leadForm.stageId,
          value: leadForm.value ? Number(leadForm.value) : null,
          notes: leadForm.notes || null,
          contactId: leadForm.contactId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success(selectedLead ? "Lead atualizado!" : "Lead adicionado!");
      setIsLeadOpen(false);
      setLeadForm(initialLeadForm);
      setSelectedLead(null);
      fetchPipeline();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead) return;

    try {
      const response = await fetch(`/api/pipelines/${id}/leads/${selectedLead.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erro ao excluir lead");

      toast.success("Lead excluído!");
      setIsLeadOpen(false);
      setSelectedLead(null);
      fetchPipeline();
    } catch {
      toast.error("Erro ao excluir lead");
    }
  };

  const activeLead = pipeline?.leads.find((l) => l.id === activeId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
        <h2 className="text-xl font-semibold">Pipeline não encontrada</h2>
        <Button asChild className="mt-4">
          <Link href="/pipelines">Voltar para Pipelines</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/pipelines">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: pipeline.color }}
              />
              <h1 className="text-2xl font-bold">{pipeline.name}</h1>
            </div>
            {pipeline.description && (
              <p className="text-sm text-muted-foreground">{pipeline.description}</p>
            )}
          </div>
        </div>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4">
            {pipeline.stages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                leads={pipeline.leads.filter((l) => l.stageId === stage.id)}
                onAddLead={() => handleAddLead(stage.id)}
                onLeadClick={handleLeadClick}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <DragOverlay>
          {activeLead ? <LeadCardOverlay lead={activeLead} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Dialog de Lead */}
      <Dialog open={isLeadOpen} onOpenChange={setIsLeadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedLead ? "Editar Lead" : "Novo Lead"}</DialogTitle>
            <DialogDescription>
              {selectedLead
                ? "Atualize as informações do lead."
                : "Adicione um novo lead à pipeline."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLeadSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={leadForm.title}
                  onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })}
                  placeholder="Ex: Projeto Website"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="value">Valor</Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    value={leadForm.value}
                    onChange={(e) => setLeadForm({ ...leadForm, value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="stageId">Estágio</Label>
                  <Select
                    value={leadForm.stageId}
                    onValueChange={(value) => setLeadForm({ ...leadForm, stageId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipeline.stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: stage.color }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contactId">Contato</Label>
                <Select
                  value={leadForm.contactId}
                  onValueChange={(value) => setLeadForm({ ...leadForm, contactId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um contato (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  placeholder="Informações adicionais"
                />
              </div>
            </div>
            <DialogFooter>
              {selectedLead && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteLead}
                  className="mr-auto"
                >
                  Excluir
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setIsLeadOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedLead ? "Salvar" : "Adicionar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Motivo da Mudança */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover Lead</DialogTitle>
            <DialogDescription>
              Informe o motivo da mudança de estágio (opcional).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Motivo</Label>
            <Textarea
              id="reason"
              value={moveReason}
              onChange={(e) => setMoveReason(e.target.value)}
              placeholder="Ex: Cliente respondeu positivamente à proposta"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsMoveOpen(false);
                setPendingMove(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={confirmMove} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
