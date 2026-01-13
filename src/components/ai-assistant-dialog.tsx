"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Loader2,
  Save,
  TestTube,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "sonner";

interface ProviderModel {
  id: string;
  name: string;
  default?: boolean;
}

interface AIConfig {
  id: string;
  provider: string;
  model: string;
  apiKeyMasked: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  contextMessages: number;
  isEnabled: boolean;
}

interface AIAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  sessionName: string;
}

const providerLabels: Record<string, string> = {
  OPENAI: "OpenAI (ChatGPT)",
  ANTHROPIC: "Anthropic (Claude)",
  DEEPSEEK: "DeepSeek",
  GEMINI: "Google Gemini",
};

export function AIAssistantDialog({
  open,
  onOpenChange,
  sessionId,
  sessionName,
}: AIAssistantDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [configExists, setConfigExists] = useState(false);
  const [providerModels, setProviderModels] = useState<Record<string, ProviderModel[]>>({});
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState("");

  // Form state
  const [provider, setProvider] = useState("OPENAI");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [contextMessages, setContextMessages] = useState(10);
  const [isEnabled, setIsEnabled] = useState(false);

  // Fetch config when dialog opens
  useEffect(() => {
    if (open && sessionId) {
      fetchConfig();
    }
  }, [open, sessionId]);

  // Update model when provider changes
  useEffect(() => {
    if (providerModels[provider] && !configExists) {
      const defaultModel = providerModels[provider].find(m => m.default) || providerModels[provider][0];
      if (defaultModel) {
        setModel(defaultModel.id);
      }
    }
  }, [provider, providerModels, configExists]);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/whatsapp/${sessionId}/ai-assistant`);
      const data = await response.json();

      setProviderModels(data.providerModels || {});

      if (data.exists && data.config) {
        setConfigExists(true);
        setProvider(data.config.provider);
        setModel(data.config.model);
        setApiKeyMasked(data.config.apiKeyMasked);
        setSystemPrompt(data.config.systemPrompt);
        setTemperature(data.config.temperature);
        setMaxTokens(data.config.maxTokens);
        setContextMessages(data.config.contextMessages);
        setIsEnabled(data.config.isEnabled);
      } else {
        setConfigExists(false);
        // Set defaults
        setProvider("OPENAI");
        setApiKey("");
        setApiKeyMasked("");
        setSystemPrompt("");
        setTemperature(0.7);
        setMaxTokens(1024);
        setContextMessages(10);
        setIsEnabled(false);
      }
    } catch (error) {
      toast.error("Erro ao carregar configuracao");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey && !configExists) {
      toast.error("Informe a API Key");
      return;
    }
    if (!systemPrompt || systemPrompt.length < 10) {
      toast.error("O prompt do sistema deve ter pelo menos 10 caracteres");
      return;
    }

    setIsSaving(true);
    try {
      const method = configExists ? "PUT" : "POST";
      const body: Record<string, unknown> = {
        provider,
        model,
        systemPrompt,
        temperature,
        maxTokens,
        contextMessages,
        isEnabled,
      };

      // Only send apiKey if it was changed
      if (apiKey) {
        body.apiKey = apiKey;
      }

      const response = await fetch(`/api/whatsapp/${sessionId}/ai-assistant`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao salvar");
      }

      toast.success(configExists ? "Configuracao atualizada!" : "Configuracao criada!");
      setConfigExists(true);
      setApiKey(""); // Clear the input after save
      await fetchConfig(); // Refresh to get masked key
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testMessage) {
      toast.error("Digite uma mensagem de teste");
      return;
    }
    if (!apiKey && !configExists) {
      toast.error("Salve a configuracao com a API Key primeiro");
      return;
    }
    if (!systemPrompt || systemPrompt.length < 10) {
      toast.error("Preencha as instrucoes do sistema (minimo 10 caracteres)");
      return;
    }

    setIsTesting(true);
    setTestResponse("");
    try {
      const response = await fetch(`/api/whatsapp/${sessionId}/ai-assistant/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          model,
          apiKey: apiKey || undefined, // Backend will use stored key if not provided
          systemPrompt,
          temperature,
          testMessage,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTestResponse(data.response);
        toast.success("Teste realizado com sucesso!");
      } else {
        toast.error(data.error || "Erro no teste");
      }
    } catch (error) {
      toast.error("Erro ao testar configuracao");
    } finally {
      setIsTesting(false);
    }
  };

  const currentModels = providerModels[provider] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Assistente de IA - {sessionName}
          </DialogTitle>
          <DialogDescription>
            Configure um assistente de IA para responder automaticamente as mensagens
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Ativar Assistente</Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativado, a IA respondera automaticamente todas as mensagens
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>

            {/* Provider Selection */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Provedor de IA</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(providerLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modelo</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  placeholder={configExists ? `Chave atual: ${apiKeyMasked}` : "Cole sua API Key aqui"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {configExists
                  ? "Deixe em branco para manter a chave atual"
                  : "Obtenha sua API Key no site do provedor"}
              </p>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <Label>Instrucoes do Sistema (System Prompt)</Label>
              <Textarea
                placeholder="Descreva como o assistente deve se comportar, informacoes sobre sua empresa, produtos, precos, etc."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {systemPrompt.length} caracteres - Minimo 10 caracteres
              </p>
            </div>

            {/* Advanced Settings */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Configuracoes Avancadas
              </h4>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Temperature */}
                <div className="space-y-2">
                  <Label>Temperatura</Label>
                  <Input
                    type="number"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
                    min={0}
                    max={2}
                    step={0.1}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = focado, 2 = criativo
                  </p>
                </div>

                {/* Max Tokens */}
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                    min={100}
                    max={4096}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tamanho maximo da resposta
                  </p>
                </div>

                {/* Context Messages */}
                <div className="space-y-2">
                  <Label>Mensagens de Contexto</Label>
                  <Input
                    type="number"
                    value={contextMessages}
                    onChange={(e) => setContextMessages(parseInt(e.target.value) || 10)}
                    min={1}
                    max={50}
                  />
                  <p className="text-xs text-muted-foreground">
                    Historico enviado para a IA
                  </p>
                </div>
              </div>
            </div>

            {/* Test Section */}
            <div className="space-y-4 p-4 rounded-lg border border-border/40 bg-background">
              <h4 className="font-medium flex items-center gap-2">
                <TestTube className="h-4 w-4" />
                Testar Configuracao
              </h4>

              <div className="space-y-2">
                <Input
                  placeholder="Digite uma mensagem de teste..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting || !testMessage}
                  className="w-full"
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testando...
                    </>
                  ) : (
                    <>
                      <TestTube className="mr-2 h-4 w-4" />
                      Enviar Teste
                    </>
                  )}
                </Button>
              </div>

              {testResponse && (
                <div className="p-3 rounded-lg bg-accent/50">
                  <Label className="text-xs text-muted-foreground">Resposta da IA:</Label>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{testResponse}</p>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Configuracao
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
