#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Configuração
const LEADPRO_API_URL = process.env.LEADPRO_API_URL || "http://localhost:3000";
const LEADPRO_API_TOKEN = process.env.LEADPRO_API_TOKEN || "";

// Helper para fazer requisições à API
async function apiRequest(
  endpoint: string,
  method: string = "GET",
  body?: unknown
): Promise<unknown> {
  const response = await fetch(`${LEADPRO_API_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LEADPRO_API_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`API Error: ${error.error || response.statusText}`);
  }

  return response.json();
}

// Definição das ferramentas
const tools = [
  {
    name: "leadpro_list_pipelines",
    description: "Lista todas as pipelines do usuário",
    inputSchema: {
      type: "object" as const,
      properties: {
        includeStages: {
          type: "boolean",
          description: "Incluir estágios de cada pipeline",
        },
        includeLeads: {
          type: "boolean",
          description: "Incluir leads de cada pipeline",
        },
      },
    },
  },
  {
    name: "leadpro_get_pipeline",
    description: "Obtém detalhes de uma pipeline específica",
    inputSchema: {
      type: "object" as const,
      properties: {
        pipelineId: {
          type: "string",
          description: "ID da pipeline",
        },
      },
      required: ["pipelineId"],
    },
  },
  {
    name: "leadpro_create_pipeline",
    description: "Cria uma nova pipeline",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Nome da pipeline",
        },
        description: {
          type: "string",
          description: "Descrição da pipeline",
        },
        color: {
          type: "string",
          description: "Cor da pipeline (hexadecimal, ex: #3B82F6)",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "leadpro_add_lead_to_pipeline",
    description: "Adiciona um lead a uma pipeline",
    inputSchema: {
      type: "object" as const,
      properties: {
        pipelineId: {
          type: "string",
          description: "ID da pipeline",
        },
        stageId: {
          type: "string",
          description: "ID do estágio",
        },
        title: {
          type: "string",
          description: "Título do lead",
        },
        value: {
          type: "number",
          description: "Valor estimado",
        },
        notes: {
          type: "string",
          description: "Notas sobre o lead",
        },
        contactId: {
          type: "string",
          description: "ID do contato associado",
        },
      },
      required: ["pipelineId", "stageId", "title"],
    },
  },
  {
    name: "leadpro_move_lead",
    description: "Move um lead para outro estágio da pipeline",
    inputSchema: {
      type: "object" as const,
      properties: {
        pipelineId: {
          type: "string",
          description: "ID da pipeline",
        },
        leadId: {
          type: "string",
          description: "ID do lead na pipeline",
        },
        toStageId: {
          type: "string",
          description: "ID do estágio de destino",
        },
        reason: {
          type: "string",
          description: "Motivo da mudança",
        },
      },
      required: ["pipelineId", "leadId", "toStageId"],
    },
  },
  {
    name: "leadpro_list_contacts",
    description: "Lista todos os contatos",
    inputSchema: {
      type: "object" as const,
      properties: {
        search: {
          type: "string",
          description: "Termo de busca",
        },
        limit: {
          type: "number",
          description: "Limite de resultados",
        },
      },
    },
  },
  {
    name: "leadpro_create_contact",
    description: "Cria um novo contato",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "Nome do contato",
        },
        email: {
          type: "string",
          description: "Email do contato",
        },
        phone: {
          type: "string",
          description: "Telefone do contato",
        },
        position: {
          type: "string",
          description: "Cargo do contato",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "leadpro_list_leads",
    description: "Lista todos os leads (CRM)",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description: "Filtrar por status (NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST)",
        },
        search: {
          type: "string",
          description: "Termo de busca",
        },
      },
    },
  },
  {
    name: "leadpro_get_inbox",
    description: "Obtém a caixa de entrada unificada (WhatsApp + Site)",
    inputSchema: {
      type: "object" as const,
      properties: {
        channel: {
          type: "string",
          description: "Filtrar por canal: all, whatsapp, webchat",
        },
      },
    },
  },
  {
    name: "leadpro_send_whatsapp",
    description: "Envia mensagem pelo WhatsApp",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "ID da sessão do WhatsApp",
        },
        to: {
          type: "string",
          description: "Número de destino (ex: 5511999999999@s.whatsapp.net)",
        },
        message: {
          type: "string",
          description: "Conteúdo da mensagem",
        },
      },
      required: ["sessionId", "to", "message"],
    },
  },
  {
    name: "leadpro_list_whatsapp_sessions",
    description: "Lista as sessões de WhatsApp conectadas",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "leadpro_list_conversations",
    description: "Lista conversas de uma sessão WhatsApp",
    inputSchema: {
      type: "object" as const,
      properties: {
        sessionId: {
          type: "string",
          description: "ID da sessão do WhatsApp",
        },
      },
      required: ["sessionId"],
    },
  },
];

// Handler para executar as ferramentas
async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "leadpro_list_pipelines": {
      const params = new URLSearchParams();
      if (args.includeStages) params.set("includeStages", "true");
      if (args.includeLeads) params.set("includeLeads", "true");
      const result = await apiRequest(`/api/pipelines?${params}`);
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_get_pipeline": {
      const result = await apiRequest(`/api/pipelines/${args.pipelineId}`);
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_create_pipeline": {
      const result = await apiRequest("/api/pipelines", "POST", {
        name: args.name,
        description: args.description,
        color: args.color,
      });
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_add_lead_to_pipeline": {
      const result = await apiRequest(
        `/api/pipelines/${args.pipelineId}/leads`,
        "POST",
        {
          title: args.title,
          stageId: args.stageId,
          value: args.value,
          notes: args.notes,
          contactId: args.contactId,
        }
      );
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_move_lead": {
      const result = await apiRequest(
        `/api/pipelines/${args.pipelineId}/leads/${args.leadId}/move`,
        "POST",
        {
          toStageId: args.toStageId,
          reason: args.reason,
        }
      );
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_list_contacts": {
      const params = new URLSearchParams();
      if (args.search) params.set("search", args.search as string);
      if (args.limit) params.set("limit", String(args.limit));
      const result = await apiRequest(`/api/contacts?${params}`);
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_create_contact": {
      const result = await apiRequest("/api/contacts", "POST", {
        name: args.name,
        email: args.email,
        phone: args.phone,
        position: args.position,
      });
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_list_leads": {
      const params = new URLSearchParams();
      if (args.status) params.set("status", args.status as string);
      if (args.search) params.set("search", args.search as string);
      const result = await apiRequest(`/api/leads?${params}`);
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_get_inbox": {
      const channel = (args.channel as string) || "all";
      const result = await apiRequest(`/api/inbox?channel=${channel}`);
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_send_whatsapp": {
      const result = await apiRequest(
        `/api/whatsapp/${args.sessionId}/messages`,
        "POST",
        {
          to: args.to,
          message: args.message,
        }
      );
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_list_whatsapp_sessions": {
      const result = await apiRequest("/api/whatsapp");
      return JSON.stringify(result, null, 2);
    }

    case "leadpro_list_conversations": {
      const result = await apiRequest(
        `/api/whatsapp/${args.sessionId}/conversations`
      );
      return JSON.stringify(result, null, 2);
    }

    default:
      throw new Error(`Ferramenta desconhecida: ${name}`);
  }
}

// Criar servidor MCP
const server = new Server(
  {
    name: "leadpro-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler para listar ferramentas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handler para executar ferramentas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await handleToolCall(name, args as Record<string, unknown>);
    return {
      content: [{ type: "text", text: result }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Erro: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Iniciar servidor
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LeadPro MCP Server iniciado");
}

main().catch((error) => {
  console.error("Erro ao iniciar servidor:", error);
  process.exit(1);
});
