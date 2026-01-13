# LeadPro CRM

Sistema de CRM completo com integração WhatsApp, chat para sites, pipelines customizáveis e **Assistente de IA** para atendimento automático.

![Next.js](https://img.shields.io/badge/Next.js-16.1-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Prisma](https://img.shields.io/badge/Prisma-7.2-2D3748)
![Tailwind](https://img.shields.io/badge/Tailwind-4.0-38B2AC)

## Funcionalidades

### CRM Completo
- **Leads**: Gerenciamento de leads com status e fonte
- **Contatos**: Cadastro de contatos com sincronização WhatsApp
- **Empresas**: Gestão de empresas/organizações
- **Negócios**: Pipeline de vendas tradicional
- **Tarefas**: Sistema de tarefas vinculadas a leads/contatos

### Pipelines Customizáveis
- Crie múltiplas pipelines (Vendas, Suporte, etc.)
- Estágios totalmente customizáveis (nome, cor, ordem)
- Drag & Drop de leads entre estágios
- Histórico de movimentos com motivo da mudança
- Marcação de estágios de ganho/perda

### Integração WhatsApp
- Conexão via QR Code (Baileys)
- Múltiplas sessões simultâneas
- Sincronização de contatos
- Histórico de mensagens configurável
- Suporte a mídias (imagens, áudio, vídeo, documentos)
- Adicionar contatos à pipeline direto do chat

### Assistente de IA para Atendimento Automático
- **4 Provedores suportados**: OpenAI (ChatGPT), Anthropic (Claude), DeepSeek, Google Gemini
- **Configuração por sessão**: Cada número WhatsApp pode ter sua própria IA
- **Instruções personalizadas**: Descreva sua empresa, produtos, preços e regras
- **Contexto de conversa**: A IA mantém histórico das últimas N mensagens
- **Controles avançados**: Temperatura, max tokens, ativar/desativar
- **Teste antes de ativar**: Valide a configuração com mensagens de teste
- **API Keys criptografadas**: Armazenamento seguro com AES-256-GCM

### Chat Widget para Sites
- Widget embeddable com uma linha de código
- Cores e posição customizáveis
- Mensagem de boas-vindas configurável
- Restrição por domínio
- Conversas em tempo real

### Caixa de Entrada Unificada
- Visualização de todas as conversas em um só lugar
- Filtros por canal (WhatsApp, Site)
- Contagem de mensagens não lidas
- Resposta direta pelo sistema
- Suporte a mídias (imagens, áudio, vídeo, documentos)

### Automações
- Editor visual de fluxos (ReactFlow)
- Gatilhos: palavra-chave, nova conversa, todas mensagens
- Nós: enviar mensagem, aguardar resposta, condições

### Sistema de Filas (BullMQ)
- Processamento assíncrono de mensagens
- Workers para: mensagens, envios, automações, IA, notificações
- Retry automático com backoff exponencial
- Monitoramento de jobs

### MCP Server
- Integração com Claude e outros assistentes AI
- 12 ferramentas para manipular o sistema via IA
- Gestão de pipelines, leads, contatos e WhatsApp

## Tecnologias

- **Frontend**: Next.js 16, React 19, TypeScript
- **UI**: Tailwind CSS 4, Radix UI, Shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL com Prisma ORM
- **WhatsApp**: Baileys (WhatsApp Web API)
- **Storage**: MinIO (S3-compatible)
- **Queue**: BullMQ + Redis
- **Auth**: JWT
- **Drag & Drop**: dnd-kit
- **Flow Editor**: XYFlow (ReactFlow)
- **IA**: OpenAI, Anthropic, DeepSeek, Google Gemini

## Instalação

### Pré-requisitos
- Node.js 18+
- PostgreSQL
- Redis (para filas)
- MinIO (opcional, para mídias)

### Setup

```bash
# Clone o repositório
git clone https://github.com/pablocarss/leadpro.git
cd leadpro

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Execute as migrations
npx prisma migrate dev

# Inicie o servidor
npm run dev
```

### Variáveis de Ambiente

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/leadpro"

# Auth
NEXTAUTH_SECRET="sua-chave-secreta"

# Redis (para filas)
REDIS_URL="redis://localhost:6379"

# MinIO (opcional)
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_BUCKET="leadpro"

# Encryption (para API Keys de IA)
ENCRYPTION_KEY="sua-chave-64-caracteres-hex"  # Gere com: openssl rand -hex 32
```

## Uso

### Assistente de IA

1. Acesse `/integrations` e conecte uma sessão WhatsApp
2. Na sessão conectada, clique no botão **"IA"**
3. Configure o provedor (OpenAI, Anthropic, DeepSeek ou Gemini)
4. Cole sua API Key do provedor escolhido
5. Escreva as instruções sobre sua empresa, produtos e regras
6. Ajuste temperatura e outras configurações
7. **Teste** com uma mensagem antes de ativar
8. Ative o assistente - ele responderá automaticamente!

#### Provedores de IA Suportados

| Provedor | Modelos | Obter API Key |
|----------|---------|---------------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-3.5-turbo | https://platform.openai.com/api-keys |
| Anthropic | claude-3-5-sonnet, claude-3-5-haiku | https://console.anthropic.com/ |
| DeepSeek | deepseek-chat, deepseek-reasoner | https://platform.deepseek.com/ |
| Gemini | gemini-2.0-flash, gemini-1.5-flash | https://aistudio.google.com/apikey |

### Pipelines

1. Acesse `/pipelines` para ver suas pipelines
2. Clique em "Nova Pipeline" para criar
3. Clique em uma pipeline para abrir o Kanban
4. Arraste leads entre estágios (será solicitado o motivo)

### Chat Widget

1. Acesse `/widgets` e crie um widget
2. Copie o código de embed
3. Cole no seu site antes do `</body>`:

```html
<script src="https://seu-leadpro.com/widget/leadpro-chat.js" data-widget-id="SEU_WIDGET_ID"></script>
```

### WhatsApp

1. Acesse `/integrations`
2. Crie uma nova integração WhatsApp
3. Escaneie o QR Code
4. Acesse `/chat` para conversar

### MCP Server (Integração com IA)

```bash
cd mcp-server
npm install
npm run build
```

Configure no Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "leadpro": {
      "command": "node",
      "args": ["/caminho/para/leadpro/mcp-server/dist/index.js"],
      "env": {
        "LEADPRO_API_URL": "http://localhost:3000",
        "LEADPRO_API_TOKEN": "seu_token_jwt"
      }
    }
  }
}
```

## Estrutura do Projeto

```
leadpro/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Rotas de autenticação
│   │   ├── (dashboard)/       # Rotas protegidas
│   │   │   ├── chat/          # Chat WhatsApp
│   │   │   ├── inbox/         # Caixa de entrada
│   │   │   ├── pipelines/     # Pipelines customizáveis
│   │   │   ├── widgets/       # Gerenciamento de widgets
│   │   │   └── ...
│   │   └── api/               # API Routes
│   │       └── whatsapp/
│   │           └── [id]/
│   │               └── ai-assistant/  # API do Assistente IA
│   ├── components/            # Componentes React
│   │   ├── ui/               # Componentes Shadcn
│   │   └── ai-assistant-dialog.tsx  # Dialog de config IA
│   ├── lib/                   # Utilitários
│   │   ├── queue/            # Sistema de filas (BullMQ)
│   │   └── encryption.ts     # Criptografia de API Keys
│   ├── services/             # Serviços
│   │   ├── whatsapp.service.ts  # WhatsApp + trigger IA
│   │   └── ai.service.ts     # Serviço de IA multi-provider
│   └── validators/           # Schemas Zod
├── prisma/
│   └── schema.prisma         # Schema do banco (inclui AIAssistantConfig)
├── public/
│   └── widget/               # Script do chat widget
├── mcp-server/               # Servidor MCP
└── .whatsapp-sessions/       # Sessões WhatsApp (gitignore)
```

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Registro
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Usuário atual

### Pipelines
- `GET/POST /api/pipelines` - Listar/Criar pipelines
- `GET/PUT/DELETE /api/pipelines/[id]` - Pipeline específica
- `GET/POST /api/pipelines/[id]/leads` - Leads da pipeline
- `POST /api/pipelines/[id]/leads/[leadId]/move` - Mover lead

### Chat Widget
- `GET /api/webchat/widget/[widgetId]` - Config do widget (público)
- `POST /api/webchat/sessions` - Criar sessão (público)
- `GET/POST /api/webchat/sessions/[id]/messages` - Mensagens

### Caixa de Entrada
- `GET /api/inbox` - Conversas unificadas

### WhatsApp
- `GET/POST /api/whatsapp` - Sessões
- `GET /api/whatsapp/[id]/conversations` - Conversas
- `GET/POST /api/whatsapp/[id]/messages` - Mensagens

### Assistente de IA
- `GET/POST/PUT/DELETE /api/whatsapp/[id]/ai-assistant` - Configuração
- `POST /api/whatsapp/[id]/ai-assistant/test` - Testar configuração

## Docker

```bash
# Build
docker build -t leadpro .

# Run com Docker Compose
docker-compose up -d
```

## Contribuindo

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Add nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT.

---

Desenvolvido por [Pablo Cardoso](https://github.com/pablocarss)
