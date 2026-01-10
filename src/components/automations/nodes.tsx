"use client";

import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import {
  Play,
  MessageSquare,
  LayoutGrid,
  GitBranch,
  StopCircle,
  Clock,
  MessageCircle,
  X,
  Plus,
  GripVertical,
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

// Types
export interface NodeData extends Record<string, unknown> {
  label: string;
  message?: string;
  buttons?: { id: string; label: string }[];
  condition?: { variable: string; operator: string; value: string };
  delay?: number;
  delayUnit?: "seconds" | "minutes" | "hours";
  inputVariable?: string;
  inputPrompt?: string;
}

// Base node wrapper
const NodeWrapper = ({
  children,
  icon: Icon,
  color,
  title,
  selected,
}: {
  children: React.ReactNode;
  icon: React.ElementType;
  color: string;
  title: string;
  selected?: boolean;
}) => (
  <div
    className={`min-w-[250px] rounded-lg border-2 bg-card shadow-lg transition-all ${
      selected ? "border-primary ring-2 ring-primary/20" : "border-border/60"
    }`}
  >
    <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${color}`}>
      <Icon className="h-4 w-4 text-white" />
      <span className="text-sm font-medium text-white">{title}</span>
    </div>
    <div className="p-3">{children}</div>
  </div>
);

// Start Node
export const StartNode = memo(({ data, selected }: NodeProps) => {
  return (
    <>
      <NodeWrapper
        icon={Play}
        color="bg-green-500"
        title="Início"
        selected={selected}
      >
        <p className="text-xs text-muted-foreground">
          Ponto de entrada do fluxo. A automação começa aqui quando o gatilho é ativado.
        </p>
      </NodeWrapper>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
      />
    </>
  );
});
StartNode.displayName = "StartNode";

// Message Node
export const MessageNode = memo(
  ({ data, selected }: NodeProps & { data: NodeData }) => {
    return (
      <>
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
        />
        <NodeWrapper
          icon={MessageSquare}
          color="bg-blue-500"
          title="Mensagem"
          selected={selected}
        >
          <div className="space-y-2">
            <div className="p-2 bg-muted/50 rounded text-sm min-h-[60px]">
              {data.message || (
                <span className="text-muted-foreground italic">
                  Clique para editar a mensagem...
                </span>
              )}
            </div>
          </div>
        </NodeWrapper>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
        />
      </>
    );
  }
);
MessageNode.displayName = "MessageNode";

// Buttons Node
export const ButtonsNode = memo(
  ({ data, selected }: NodeProps & { data: NodeData }) => {
    const buttons = data.buttons || [];

    return (
      <>
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
        />
        <NodeWrapper
          icon={LayoutGrid}
          color="bg-purple-500"
          title="Botões"
          selected={selected}
        >
          <div className="space-y-2">
            {data.message && (
              <div className="p-2 bg-muted/50 rounded text-sm">
                {data.message}
              </div>
            )}
            <div className="space-y-1">
              {buttons.length > 0 ? (
                buttons.map((btn, index) => (
                  <div
                    key={btn.id}
                    className="flex items-center gap-2 p-2 bg-purple-500/10 rounded text-sm border border-purple-500/20"
                  >
                    <span className="text-purple-600 font-medium">{index + 1}.</span>
                    <span>{btn.label}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Clique para adicionar botões...
                </p>
              )}
            </div>
          </div>
        </NodeWrapper>
        {buttons.map((btn, index) => (
          <Handle
            key={btn.id}
            type="source"
            position={Position.Bottom}
            id={btn.id}
            className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
            style={{ left: `${((index + 1) / (buttons.length + 1)) * 100}%` }}
          />
        ))}
        {buttons.length === 0 && (
          <Handle
            type="source"
            position={Position.Bottom}
            className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
          />
        )}
      </>
    );
  }
);
ButtonsNode.displayName = "ButtonsNode";

// Condition Node
export const ConditionNode = memo(
  ({ data, selected }: NodeProps & { data: NodeData }) => {
    const condition = data.condition || { variable: "", operator: "equals", value: "" };

    return (
      <>
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-yellow-500 !border-2 !border-white"
        />
        <NodeWrapper
          icon={GitBranch}
          color="bg-yellow-500"
          title="Condição"
          selected={selected}
        >
          <div className="space-y-2">
            {condition.variable ? (
              <div className="p-2 bg-yellow-500/10 rounded text-sm border border-yellow-500/20">
                <span className="font-mono text-yellow-600">
                  {condition.variable}
                </span>{" "}
                <span className="text-muted-foreground">
                  {condition.operator === "equals"
                    ? "é igual a"
                    : condition.operator === "contains"
                    ? "contém"
                    : condition.operator === "starts_with"
                    ? "começa com"
                    : "diferente de"}
                </span>{" "}
                <span className="font-semibold">&quot;{condition.value}&quot;</span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Clique para configurar a condição...
              </p>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="text-green-600">✓ Verdadeiro</span>
              <span className="text-red-600">✗ Falso</span>
            </div>
          </div>
        </NodeWrapper>
        <Handle
          type="source"
          position={Position.Bottom}
          id="true"
          className="!w-3 !h-3 !bg-green-500 !border-2 !border-white"
          style={{ left: "30%" }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="false"
          className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
          style={{ left: "70%" }}
        />
      </>
    );
  }
);
ConditionNode.displayName = "ConditionNode";

// Delay Node
export const DelayNode = memo(
  ({ data, selected }: NodeProps & { data: NodeData }) => {
    const delay = data.delay || 5;
    const unit = data.delayUnit || "seconds";
    const unitLabel = unit === "seconds" ? "segundos" : unit === "minutes" ? "minutos" : "horas";

    return (
      <>
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
        />
        <NodeWrapper
          icon={Clock}
          color="bg-orange-500"
          title="Aguardar"
          selected={selected}
        >
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-orange-500" />
            <span>
              Aguardar <strong>{delay}</strong> {unitLabel}
            </span>
          </div>
        </NodeWrapper>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
        />
      </>
    );
  }
);
DelayNode.displayName = "DelayNode";

// Input Node
export const InputNode = memo(
  ({ data, selected }: NodeProps & { data: NodeData }) => {
    return (
      <>
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
        />
        <NodeWrapper
          icon={MessageCircle}
          color="bg-cyan-500"
          title="Aguardar Resposta"
          selected={selected}
        >
          <div className="space-y-2">
            {data.inputPrompt && (
              <div className="p-2 bg-muted/50 rounded text-sm">
                {data.inputPrompt}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Salvar em:</span>
              <span className="font-mono bg-cyan-500/10 px-1 rounded">
                {data.inputVariable || "resposta"}
              </span>
            </div>
          </div>
        </NodeWrapper>
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white"
        />
      </>
    );
  }
);
InputNode.displayName = "InputNode";

// End Node
export const EndNode = memo(({ data, selected }: NodeProps) => {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
      />
      <NodeWrapper
        icon={StopCircle}
        color="bg-red-500"
        title="Fim"
        selected={selected}
      >
        <p className="text-xs text-muted-foreground">
          O fluxo termina aqui. O atendimento será finalizado.
        </p>
      </NodeWrapper>
    </>
  );
});
EndNode.displayName = "EndNode";

// Export all node types
export const nodeTypes = {
  startNode: StartNode,
  messageNode: MessageNode,
  buttonsNode: ButtonsNode,
  conditionNode: ConditionNode,
  delayNode: DelayNode,
  inputNode: InputNode,
  endNode: EndNode,
};
