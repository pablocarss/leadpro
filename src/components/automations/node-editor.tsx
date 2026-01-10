"use client";

import { useState, useEffect } from "react";
import { Node } from "@xyflow/react";
import {
  X,
  Plus,
  Trash2,
  MessageSquare,
  LayoutGrid,
  GitBranch,
  Clock,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NodeData } from "./nodes";

interface NodeEditorProps {
  node: Node<NodeData> | null;
  onUpdate: (nodeId: string, data: Partial<NodeData>) => void;
  onClose: () => void;
}

export function NodeEditor({ node, onUpdate, onClose }: NodeEditorProps) {
  const [localData, setLocalData] = useState<NodeData>(node?.data || { label: "" });

  useEffect(() => {
    if (node) {
      setLocalData(node.data);
    }
  }, [node]);

  if (!node) return null;

  const handleChange = (key: keyof NodeData, value: unknown) => {
    const newData = { ...localData, [key]: value };
    setLocalData(newData);
    onUpdate(node.id, { [key]: value });
  };

  const handleButtonAdd = () => {
    const newButtons = [
      ...(localData.buttons || []),
      { id: `btn-${Date.now()}`, label: `Opção ${(localData.buttons?.length || 0) + 1}` },
    ];
    handleChange("buttons", newButtons);
  };

  const handleButtonRemove = (id: string) => {
    const newButtons = (localData.buttons || []).filter((btn) => btn.id !== id);
    handleChange("buttons", newButtons);
  };

  const handleButtonLabelChange = (id: string, label: string) => {
    const newButtons = (localData.buttons || []).map((btn) =>
      btn.id === id ? { ...btn, label } : btn
    );
    handleChange("buttons", newButtons);
  };

  const renderEditor = () => {
    switch (node.type) {
      case "messageNode":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-500">
              <MessageSquare className="h-5 w-5" />
              <span className="font-medium">Mensagem</span>
            </div>
            <div className="space-y-2">
              <Label>Texto da mensagem</Label>
              <Textarea
                placeholder="Digite a mensagem que será enviada..."
                value={localData.message || ""}
                onChange={(e) => handleChange("message", e.target.value)}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{variavel}"} para inserir valores dinâmicos.
              </p>
            </div>
          </div>
        );

      case "buttonsNode":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-purple-500">
              <LayoutGrid className="h-5 w-5" />
              <span className="font-medium">Botões</span>
            </div>
            <div className="space-y-2">
              <Label>Mensagem (opcional)</Label>
              <Textarea
                placeholder="Mensagem exibida antes dos botões..."
                value={localData.message || ""}
                onChange={(e) => handleChange("message", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Botões</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleButtonAdd}
                  disabled={(localData.buttons?.length || 0) >= 3}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {(localData.buttons || []).map((btn, index) => (
                  <div key={btn.id} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                    <Input
                      value={btn.label}
                      onChange={(e) => handleButtonLabelChange(btn.id, e.target.value)}
                      placeholder="Texto do botão"
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleButtonRemove(btn.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Máximo de 3 botões. Cada botão cria uma conexão de saída.
              </p>
            </div>
          </div>
        );

      case "conditionNode":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-yellow-500">
              <GitBranch className="h-5 w-5" />
              <span className="font-medium">Condição</span>
            </div>
            <div className="space-y-2">
              <Label>Variável</Label>
              <Input
                placeholder="Ex: resposta, nome, opcao"
                value={localData.condition?.variable || ""}
                onChange={(e) =>
                  handleChange("condition", {
                    ...localData.condition,
                    variable: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Operador</Label>
              <Select
                value={localData.condition?.operator || "equals"}
                onValueChange={(value) =>
                  handleChange("condition", {
                    ...localData.condition,
                    operator: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">É igual a</SelectItem>
                  <SelectItem value="not_equals">É diferente de</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="starts_with">Começa com</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                placeholder="Valor para comparação"
                value={localData.condition?.value || ""}
                onChange={(e) =>
                  handleChange("condition", {
                    ...localData.condition,
                    value: e.target.value,
                  })
                }
              />
            </div>
          </div>
        );

      case "delayNode":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-orange-500">
              <Clock className="h-5 w-5" />
              <span className="font-medium">Aguardar</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Tempo</Label>
                <Input
                  type="number"
                  min="1"
                  value={localData.delay || 5}
                  onChange={(e) => handleChange("delay", parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select
                  value={localData.delayUnit || "seconds"}
                  onValueChange={(value) => handleChange("delayUnit", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Segundos</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case "inputNode":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-cyan-500">
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">Aguardar Resposta</span>
            </div>
            <div className="space-y-2">
              <Label>Pergunta (opcional)</Label>
              <Textarea
                placeholder="Mensagem para solicitar a resposta..."
                value={localData.inputPrompt || ""}
                onChange={(e) => handleChange("inputPrompt", e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Salvar resposta em</Label>
              <Input
                placeholder="Nome da variável"
                value={localData.inputVariable || ""}
                onChange={(e) => handleChange("inputVariable", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A resposta do usuário será salva nesta variável para uso posterior.
              </p>
            </div>
          </div>
        );

      default:
        return (
          <p className="text-sm text-muted-foreground">
            Este tipo de nó não possui configurações editáveis.
          </p>
        );
    }
  };

  return (
    <div className="w-80 border-l border-border bg-card h-full overflow-y-auto">
      <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
        <h3 className="font-semibold">Editar Nó</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4">{renderEditor()}</div>
    </div>
  );
}
