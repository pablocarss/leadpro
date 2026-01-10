# LeadPro MCP Server

Servidor MCP (Model Context Protocol) para integração do LeadPro com Claude e outros assistentes AI.

## Instalação

```bash
cd mcp-server
npm install
npm run build
```

## Configuração no Claude Desktop

Adicione ao arquivo `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "leadpro": {
      "command": "node",
      "args": ["/caminho/para/leadpro/mcp-server/dist/index.js"],
      "env": {
        "LEADPRO_API_URL": "http://localhost:3000",
        "LEADPRO_API_TOKEN": "seu_token_jwt_aqui"
      }
    }
  }
}
```

## Obter Token JWT

1. Faça login no LeadPro
2. Abra o DevTools (F12) > Application > Cookies
3. Copie o valor do cookie `token`

## Ferramentas Disponíveis

### Pipelines
- `leadpro_list_pipelines` - Lista todas as pipelines
- `leadpro_get_pipeline` - Detalhes de uma pipeline
- `leadpro_create_pipeline` - Cria uma nova pipeline
- `leadpro_add_lead_to_pipeline` - Adiciona lead a uma pipeline
- `leadpro_move_lead` - Move lead entre estágios

### Contatos e Leads
- `leadpro_list_contacts` - Lista contatos
- `leadpro_create_contact` - Cria contato
- `leadpro_list_leads` - Lista leads do CRM

### Caixa de Entrada
- `leadpro_get_inbox` - Caixa de entrada unificada (WhatsApp + Site)

### WhatsApp
- `leadpro_list_whatsapp_sessions` - Lista sessões conectadas
- `leadpro_list_conversations` - Lista conversas de uma sessão
- `leadpro_send_whatsapp` - Envia mensagem pelo WhatsApp

## Exemplos de Uso

### Listar pipelines
```
Use a ferramenta leadpro_list_pipelines para ver minhas pipelines
```

### Adicionar lead
```
Adicione o lead "Empresa ABC" na pipeline de vendas, estágio "Qualificação", valor R$ 50.000
```

### Enviar WhatsApp
```
Envie uma mensagem pelo WhatsApp para 5511999999999 dizendo "Olá, tudo bem?"
```

## Desenvolvimento

```bash
# Rodar em modo desenvolvimento
npm run dev

# Compilar
npm run build

# Rodar versão compilada
npm start
```
