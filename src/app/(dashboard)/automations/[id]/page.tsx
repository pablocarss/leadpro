"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  Connection,
  NodeChange,
  EdgeChange,
  ReactFlowProvider,
  useReactFlow,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowLeft,
  Save,
  Loader2,
  Play,
  Pause,
  MessageSquare,
  LayoutGrid,
  GitBranch,
  Clock,
  MessageCircle,
  StopCircle,
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { nodeTypes, NodeData } from "@/components/automations/nodes";
import { NodeEditor } from "@/components/automations/node-editor";

interface Automation {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  trigger: string;
  triggerValue: string | null;
  nodes: Node<NodeData>[];
  edges: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}

const nodeTypesList = [
  {
    type: "messageNode",
    label: "Mensagem",
    icon: MessageSquare,
    color: "bg-blue-500",
    description: "Envia uma mensagem de texto",
  },
  {
    type: "buttonsNode",
    label: "Botões",
    icon: LayoutGrid,
    color: "bg-purple-500",
    description: "Exibe botões para o cliente",
  },
  {
    type: "conditionNode",
    label: "Condição",
    icon: GitBranch,
    color: "bg-yellow-500",
    description: "Cria ramificação condicional",
  },
  {
    type: "delayNode",
    label: "Aguardar",
    icon: Clock,
    color: "bg-orange-500",
    description: "Pausa antes de continuar",
  },
  {
    type: "inputNode",
    label: "Resposta",
    icon: MessageCircle,
    color: "bg-cyan-500",
    description: "Aguarda resposta do cliente",
  },
  {
    type: "endNode",
    label: "Fim",
    icon: StopCircle,
    color: "bg-red-500",
    description: "Finaliza o fluxo",
  },
];

function FlowEditor() {
  const params = useParams();
  const router = useRouter();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [automation, setAutomation] = useState<Automation | null>(null);
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch automation data
  useEffect(() => {
    const fetchAutomation = async () => {
      try {
        const response = await fetch(`/api/automations/${params.id}`);
        if (!response.ok) {
          throw new Error("Automação não encontrada");
        }
        const data = await response.json();
        setAutomation(data);
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao carregar automação");
        router.push("/automations");
      } finally {
        setIsLoading(false);
      }
    };

    if (params.id) {
      fetchAutomation();
    }
  }, [params.id, router]);

  const onNodesChange = useCallback((changes: NodeChange<Node<NodeData>>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    setHasChanges(true);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    setHasChanges(true);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          animated: true,
          style: { stroke: "#6b7280", strokeWidth: 2 },
        },
        eds
      )
    );
    setHasChanges(true);
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      // Don't edit start node
      if (node.type === "startNode") return;
      setSelectedNode(node);
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Partial<NodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
        )
      );
      setSelectedNode((prev) =>
        prev && prev.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev
      );
      setHasChanges(true);
    },
    []
  );

  const handleSave = async () => {
    if (!automation) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/automations/${automation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes,
          edges,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar");
      }

      toast.success("Automação salva!");
      setHasChanges(false);
    } catch {
      toast.error("Erro ao salvar automação");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!automation) return;

    try {
      const response = await fetch(`/api/automations/${automation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !automation.isActive }),
      });

      if (!response.ok) throw new Error("Erro ao atualizar");

      setAutomation({ ...automation, isActive: !automation.isActive });
      toast.success(automation.isActive ? "Automação pausada" : "Automação ativada");
    } catch {
      toast.error("Erro ao atualizar automação");
    }
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const nodeDefaults: Record<string, Partial<NodeData>> = {
        messageNode: { label: "Mensagem", message: "" },
        buttonsNode: { label: "Botões", message: "", buttons: [] },
        conditionNode: {
          label: "Condição",
          condition: { variable: "", operator: "equals", value: "" },
        },
        delayNode: { label: "Aguardar", delay: 5, delayUnit: "seconds" },
        inputNode: { label: "Resposta", inputPrompt: "", inputVariable: "resposta" },
        endNode: { label: "Fim" },
      };

      const newNode: Node<NodeData> = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: nodeDefaults[type] as NodeData,
      };

      setNodes((nds) => [...nds, newNode]);
      setHasChanges(true);
    },
    [screenToFlowPosition]
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!automation) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/automations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{automation.name}</h1>
            <p className="text-sm text-muted-foreground">
              {automation.description || "Sem descrição"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={automation.isActive ? "outline" : "default"}
            size="sm"
            onClick={handleToggleActive}
          >
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
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300 dark:text-black"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Node Palette */}
        <div className="w-56 border-r border-border bg-card p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-3">Adicionar Nó</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Arraste para adicionar ao fluxo
          </p>
          <div className="space-y-2">
            {nodeTypesList.map((nodeType) => (
              <div
                key={nodeType.type}
                draggable
                onDragStart={(e) => onDragStart(e, nodeType.type)}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-colors"
              >
                <div className={`h-8 w-8 rounded flex items-center justify-center ${nodeType.color}`}>
                  <nodeType.icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium">{nodeType.label}</p>
                  <p className="text-xs text-muted-foreground">{nodeType.description}</p>
                </div>
                <GripVertical className="h-4 w-4 text-muted-foreground ml-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Flow Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: "#6b7280", strokeWidth: 2 },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={15} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case "startNode":
                    return "#22c55e";
                  case "messageNode":
                    return "#3b82f6";
                  case "buttonsNode":
                    return "#a855f7";
                  case "conditionNode":
                    return "#eab308";
                  case "delayNode":
                    return "#f97316";
                  case "inputNode":
                    return "#06b6d4";
                  case "endNode":
                    return "#ef4444";
                  default:
                    return "#6b7280";
                }
              }}
              maskColor="rgba(0, 0, 0, 0.8)"
            />
          </ReactFlow>
        </div>

        {/* Node Editor Sidebar */}
        {selectedNode && (
          <NodeEditor
            node={selectedNode}
            onUpdate={handleNodeUpdate}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
    </div>
  );
}

export default function AutomationEditorPage() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}
