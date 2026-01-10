"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Loader2,
  MessageCircle,
  Plug,
  Trash2,
  QrCode,
  RefreshCw,
  ArrowLeft,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  User,
  MessageSquare,
  Power,
  PowerOff,
  Bot,
  GitBranch,
  Zap,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface WhatsappMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  isFromMe: boolean;
  timestamp: string;
}

interface Conversation {
  contact: string;
  contactName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messageCount: number;
}

interface WhatsappSession {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  qrCode: string | null;
  lastConnected: string | null;
  integrationId: string;
  isSyncing?: boolean;
  syncProgress?: string | null;
  _count?: { messages: number; contacts: number };
}

interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  createdAt: string;
  whatsappSessions: WhatsappSession[];
}

const integrationTypes = {
  WHATSAPP_OFFICIAL: { label: "WhatsApp Business API", icon: MessageCircle, description: "API oficial do WhatsApp Business" },
  WHATSAPP_BAILEYS: { label: "WhatsApp Web", icon: Smartphone, description: "Conexão via QR Code (Baileys)" },
  EMAIL_SMTP: { label: "Email SMTP", icon: Plug, description: "Envio de emails via SMTP" },
  TELEGRAM: { label: "Telegram", icon: MessageCircle, description: "Bot do Telegram" },
  INSTAGRAM: { label: "Instagram", icon: MessageCircle, description: "Direct do Instagram" },
};

const statusColors: Record<string, { bg: string; icon: React.ElementType }> = {
  CONNECTED: { bg: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle2 },
  DISCONNECTED: { bg: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: XCircle },
  CONNECTING: { bg: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: RefreshCw },
  QR_CODE: { bg: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: QrCode },
  ERROR: { bg: "bg-red-500/10 text-red-500 border-red-500/20", icon: AlertCircle },
};

const statusLabels: Record<string, string> = {
  CONNECTED: "Conectado",
  DISCONNECTED: "Desconectado",
  CONNECTING: "Conectando",
  QR_CODE: "Aguardando QR Code",
  ERROR: "Erro",
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [sessions, setSessions] = useState<WhatsappSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isIntegrationOpen, setIsIntegrationOpen] = useState(false);
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<WhatsappSession | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [newContactNumber, setNewContactNumber] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [integrationForm, setIntegrationForm] = useState({
    name: "",
    type: "WHATSAPP_BAILEYS",
  });

  const [sessionForm, setSessionForm] = useState({
    name: "",
    integrationId: "",
    syncContacts: true,
    syncHistory: true,
    historyDays: 7,
  });

  const fetchData = useCallback(async () => {
    try {
      const [intRes, sessRes] = await Promise.all([
        fetch("/api/integrations"),
        fetch("/api/whatsapp"),
      ]);

      if (intRes.ok) {
        const data = await intRes.json();
        setIntegrations(data);
      }

      if (sessRes.ok) {
        const data = await sessRes.json();
        setSessions(data);
      }
    } catch {
      toast.error("Erro ao carregar integracoes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSessionData = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/whatsapp/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedSession(data);
        return data;
      }
    } catch {
      console.error("Error fetching session data");
    }
    return null;
  }, []);

  const fetchConversations = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/whatsapp/${sessionId}/conversations`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch {
      console.error("Error fetching conversations");
    }
  }, []);

  const fetchMessages = useCallback(async (sessionId: string, contact: string) => {
    try {
      const response = await fetch(`/api/whatsapp/${sessionId}/messages?contact=${encodeURIComponent(contact)}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages.reverse());
      }
    } catch {
      console.error("Error fetching messages");
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for sync status updates
  useEffect(() => {
    const syncingSessions = sessions.filter((s) => s.isSyncing);
    if (syncingSessions.length === 0) return;

    const interval = setInterval(() => {
      fetchData();
    }, 2000);

    return () => clearInterval(interval);
  }, [sessions, fetchData]);

  useEffect(() => {
    if (isQrOpen && selectedSession) {
      const interval = setInterval(async () => {
        const data = await fetchSessionData(selectedSession.id);
        if (data && data.status === "CONNECTED") {
          setIsQrOpen(false);
          toast.success("WhatsApp conectado com sucesso!");
          fetchData();
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [isQrOpen, selectedSession, fetchSessionData, fetchData]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCreateIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(integrationForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success("Integração criada com sucesso!");
      setIsIntegrationOpen(false);
      setIntegrationForm({ name: "", type: "WHATSAPP_BAILEYS" });
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar integração");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionForm),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      const newSession = await response.json();
      toast.success("Sessão criada! Aguarde o QR Code.");
      setIsSessionOpen(false);
      setSessionForm({ name: "", integrationId: "", syncContacts: true, syncHistory: true, historyDays: 7 });

      setTimeout(async () => {
        const sessionData = await fetchSessionData(newSession.id);
        if (sessionData) {
          setSelectedSession(sessionData);
          setIsQrOpen(true);
        }
      }, 2000);

      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar sessão");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIntegration = async (id: string) => {
    try {
      const response = await fetch(`/api/integrations/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Erro ao excluir integração");

      toast.success("Integração excluída!");
      fetchData();
    } catch {
      toast.error("Erro ao excluir integração");
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      const response = await fetch(`/api/whatsapp/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Erro ao excluir sessão");

      toast.success("Sessão excluída!");
      fetchData();
    } catch {
      toast.error("Erro ao excluir sessão");
    }
  };

  const handleReconnect = async (session: WhatsappSession) => {
    try {
      const response = await fetch(`/api/whatsapp/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconnect" }),
      });

      if (!response.ok) throw new Error("Erro ao reconectar");

      toast.success("Reconectando...");

      setTimeout(async () => {
        const sessionData = await fetchSessionData(session.id);
        if (sessionData) {
          setSelectedSession(sessionData);
          if (sessionData.status === "QR_CODE" || sessionData.status === "CONNECTING") {
            setIsQrOpen(true);
          }
        }
      }, 2000);

      fetchData();
    } catch {
      toast.error("Erro ao reconectar");
    }
  };

  const handleDisconnect = async (session: WhatsappSession) => {
    try {
      const response = await fetch(`/api/whatsapp/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });

      if (!response.ok) throw new Error("Erro ao desconectar");

      toast.success("Desconectado com sucesso!");
      fetchData();
    } catch {
      toast.error("Erro ao desconectar");
    }
  };

  const openChat = async (session: WhatsappSession) => {
    setSelectedSession(session);
    await fetchConversations(session.id);
    setIsChatOpen(true);
  };

  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (selectedSession) {
      await fetchMessages(selectedSession.id, conversation.contact);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSession || !selectedConversation) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/whatsapp/${selectedSession.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedConversation.contact,
          message: newMessage,
        }),
      });

      if (!response.ok) throw new Error("Erro ao enviar mensagem");

      setNewMessage("");
      await fetchMessages(selectedSession.id, selectedConversation.contact);
      toast.success("Mensagem enviada!");
    } catch {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  const startNewConversation = async () => {
    if (!newContactNumber.trim() || !selectedSession) return;

    const contact = newContactNumber.replace(/\D/g, "") + "@s.whatsapp.net";
    // Check if conversation already exists
    const existingConv = conversations.find((c) => c.contact === contact);
    if (existingConv) {
      setSelectedConversation(existingConv);
      setNewContactNumber("");
      return;
    }

    const newConv: Conversation = {
      contact,
      contactName: newContactNumber,
      lastMessage: "",
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      messageCount: 0,
    };

    setConversations([newConv, ...conversations]);
    setSelectedConversation(newConv);
    setNewContactNumber("");
    setMessages([]);
  };

  const whatsappIntegrations = integrations.filter(
    (i) => i.type === "WHATSAPP_BAILEYS" || i.type === "WHATSAPP_OFFICIAL"
  );

  const connectedSessions = sessions.filter((s) => s.status === "CONNECTED");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Integracoes</h1>
          <p className="text-muted-foreground">Conecte seus canais de comunicacao.</p>
        </div>
        <Button onClick={() => setIsIntegrationOpen(true)} className="bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300 dark:text-black">
          <Plus className="mr-2 h-4 w-4" />
          Nova Integração
        </Button>
      </div>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversas
            {connectedSessions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {connectedSessions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="automations" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Automações
          </TabsTrigger>
          <TabsTrigger value="other" className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Outras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          {whatsappIntegrations.length === 0 ? (
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mb-4">
                  <MessageCircle className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold">Conecte seu WhatsApp</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Integre o WhatsApp ao seu CRM para enviar e receber mensagens diretamente pela plataforma.
                </p>
                <Button onClick={() => setIsIntegrationOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar WhatsApp
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {whatsappIntegrations.map((integration) => (
                <Card key={integration.id} className="border-border/40 bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                          <MessageCircle className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{integration.name}</CardTitle>
                          <CardDescription>
                            {integrationTypes[integration.type as keyof typeof integrationTypes]?.label}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSessionForm({ ...sessionForm, integrationId: integration.id });
                            setIsSessionOpen(true);
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Nova Sessão
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDeleteIntegration(integration.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {sessions.filter((s) => s.integrationId === integration.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma sessão ativa. Crie uma nova sessão para conectar.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {sessions
                          .filter((s) => s.integrationId === integration.id)
                          .map((session) => {
                            const StatusIcon = statusColors[session.status]?.icon || XCircle;
                            return (
                              <div
                                key={session.id}
                                className="flex flex-col gap-2 p-3 rounded-lg border border-border/40 bg-background/50"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                      <p className="font-medium">{session.name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {session.phone || "Aguardando conexão"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={statusColors[session.status]?.bg}>
                                      <StatusIcon className="mr-1 h-3 w-3" />
                                      {statusLabels[session.status]}
                                    </Badge>

                                    {session.status === "CONNECTED" && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openChat(session)}
                                        >
                                          <MessageSquare className="mr-2 h-4 w-4" />
                                          Conversas
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDisconnect(session)}
                                        >
                                          <PowerOff className="mr-2 h-4 w-4" />
                                          Desconectar
                                        </Button>
                                      </>
                                    )}

                                    {(session.status === "QR_CODE" || session.status === "CONNECTING") && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={async () => {
                                          const data = await fetchSessionData(session.id);
                                          if (data) {
                                            setSelectedSession(data);
                                            setIsQrOpen(true);
                                          }
                                        }}
                                      >
                                        <QrCode className="mr-2 h-4 w-4" />
                                        Ver QR Code
                                      </Button>
                                    )}

                                    {(session.status === "DISCONNECTED" || session.status === "ERROR") && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleReconnect(session)}
                                      >
                                        <Power className="mr-2 h-4 w-4" />
                                        Reconectar
                                      </Button>
                                    )}

                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive"
                                      onClick={() => handleDeleteSession(session.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                {/* Sync Progress Indicator */}
                                {session.isSyncing && (
                                  <div className="flex items-center gap-3 px-2 py-2 bg-blue-500/10 rounded-md border border-blue-500/20">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                        Sincronizando...
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {session.syncProgress || "Aguarde enquanto as mensagens são importadas"}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Stats */}
                                {session.status === "CONNECTED" && session._count && !session.isSyncing && (
                                  <div className="flex items-center gap-4 px-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <MessageSquare className="h-3 w-3" />
                                      {session._count.messages} mensagens
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {session._count.contacts} contatos
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="conversations" className="space-y-4">
          {connectedSessions.length === 0 ? (
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-gray-500/20 to-gray-600/20 flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold">Nenhuma sessão conectada</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Conecte uma sessão do WhatsApp para visualizar suas conversas.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connectedSessions.map((session) => (
                <Card
                  key={session.id}
                  className="border-border/40 bg-card/50 backdrop-blur-sm cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => openChat(session)}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <MessageCircle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{session.name}</CardTitle>
                        <CardDescription>{session.phone}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={statusColors[session.status]?.bg}>
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Conectado
                      </Badge>
                      <Button variant="outline" size="sm">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Abrir Chat
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="automations" className="space-y-4">
          <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Automações de Atendimento</CardTitle>
                    <CardDescription>
                      Crie fluxos automatizados para atendimento ao cliente via WhatsApp
                    </CardDescription>
                  </div>
                </div>
                <Button asChild className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700">
                  <Link href="/automations">
                    <Zap className="mr-2 h-4 w-4" />
                    Acessar Automações
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-start gap-3 p-4 rounded-lg border border-border/40 bg-background/50">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <MessageSquare className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-medium">Mensagens</h4>
                    <p className="text-sm text-muted-foreground">
                      Envie mensagens automáticas para seus clientes
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg border border-border/40 bg-background/50">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <GitBranch className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <h4 className="font-medium">Fluxos Condicionais</h4>
                    <p className="text-sm text-muted-foreground">
                      Crie lógica condicional baseada nas respostas
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg border border-border/40 bg-background/50">
                  <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-medium">Gatilhos</h4>
                    <p className="text-sm text-muted-foreground">
                      Inicie automações por palavras-chave ou eventos
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(integrationTypes)
              .filter(([key]) => key !== "WHATSAPP_BAILEYS" && key !== "WHATSAPP_OFFICIAL")
              .map(([key, value]) => (
                <Card key={key} className="border-border/40 bg-card/50 backdrop-blur-sm opacity-60">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                        <value.icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{value.label}</CardTitle>
                        <CardDescription>{value.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">Em breve</Badge>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Nova Integração */}
      <Dialog open={isIntegrationOpen} onOpenChange={setIsIntegrationOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Integração</DialogTitle>
            <DialogDescription>Selecione o tipo de integração que deseja criar.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateIntegration}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  placeholder="Ex: WhatsApp Principal"
                  value={integrationForm.name}
                  onChange={(e) => setIntegrationForm({ ...integrationForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={integrationForm.type}
                  onValueChange={(value) => setIntegrationForm({ ...integrationForm, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP_BAILEYS">WhatsApp Web (QR Code)</SelectItem>
                    <SelectItem value="WHATSAPP_OFFICIAL">WhatsApp Business API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsIntegrationOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Nova Sessão */}
      <Dialog open={isSessionOpen} onOpenChange={setIsSessionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Sessão WhatsApp</DialogTitle>
            <DialogDescription>Crie uma nova sessão para conectar um número de WhatsApp.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSession}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="sessionName">Nome da Sessão</Label>
                <Input
                  id="sessionName"
                  placeholder="Ex: Atendimento, Vendas"
                  value={sessionForm.name}
                  onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Opções de Sincronização</h4>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="syncContacts">Sincronizar Contatos</Label>
                      <p className="text-xs text-muted-foreground">
                        Importar contatos do WhatsApp para o CRM
                      </p>
                    </div>
                    <Switch
                      id="syncContacts"
                      checked={sessionForm.syncContacts}
                      onCheckedChange={(checked) => setSessionForm({ ...sessionForm, syncContacts: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="syncHistory">Sincronizar Conversas</Label>
                      <p className="text-xs text-muted-foreground">
                        Importar histórico de mensagens
                      </p>
                    </div>
                    <Switch
                      id="syncHistory"
                      checked={sessionForm.syncHistory}
                      onCheckedChange={(checked) => setSessionForm({ ...sessionForm, syncHistory: checked })}
                    />
                  </div>

                  {sessionForm.syncHistory && (
                    <div className="flex items-center justify-between pl-4 border-l-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="historyDays">Dias de Histórico</Label>
                        <p className="text-xs text-muted-foreground">
                          Quantos dias de mensagens importar
                        </p>
                      </div>
                      <Select
                        value={sessionForm.historyDays.toString()}
                        onValueChange={(value) => setSessionForm({ ...sessionForm, historyDays: parseInt(value) })}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 dia</SelectItem>
                          <SelectItem value="3">3 dias</SelectItem>
                          <SelectItem value="7">7 dias</SelectItem>
                          <SelectItem value="14">14 dias</SelectItem>
                          <SelectItem value="30">30 dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSessionOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar e Gerar QR Code
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog QR Code */}
      <Dialog open={isQrOpen} onOpenChange={setIsQrOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code abaixo com seu WhatsApp para conectar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            {selectedSession?.status === "CONNECTING" && !selectedSession?.qrCode && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            )}
            {selectedSession?.qrCode && (
              <div className="p-4 bg-white rounded-lg">
                <Image
                  src={selectedSession.qrCode}
                  alt="QR Code WhatsApp"
                  width={256}
                  height={256}
                  className="rounded"
                />
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Abra o WhatsApp no seu celular, va em Configuracoes &gt; Dispositivos conectados &gt; Conectar dispositivo
            </p>
            <div className="flex items-center gap-2 mt-4">
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Aguardando conexão...</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQrOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Chat */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="sm:max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              Conversas - {selectedSession?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex h-full gap-4">
            {/* Lista de conversas */}
            <div className="w-1/3 border-r border-border/40 pr-4">
              <div className="mb-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Novo número..."
                    value={newContactNumber}
                    onChange={(e) => setNewContactNumber(e.target.value)}
                  />
                  <Button size="icon" onClick={startNewConversation} disabled={!newContactNumber.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[calc(100%-60px)]">
                {conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma conversa ainda
                  </p>
                ) : (
                  <div className="space-y-2">
                    {conversations.map((conv, index) => (
                      <div
                        key={`${conv.contact}-${index}`}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedConversation?.contact === conv.contact
                            ? "bg-accent"
                            : "hover:bg-accent/50"
                        }`}
                        onClick={() => selectConversation(conv)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                            <User className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{conv.contactName}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.lastMessage || "Sem mensagens"}
                            </p>
                          </div>
                          {conv.unreadCount > 0 && (
                            <Badge className="bg-green-500">{conv.unreadCount}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Area de mensagens */}
            <div className="flex-1 flex flex-col">
              {selectedConversation ? (
                <>
                  <div className="border-b border-border/40 pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">{selectedConversation.contactName}</p>
                        <p className="text-sm text-muted-foreground">{selectedConversation.contact}</p>
                      </div>
                    </div>
                  </div>
                  <ScrollArea className="flex-1 pr-4">
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.isFromMe ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] p-3 rounded-lg ${
                              msg.isFromMe
                                ? "bg-green-500/20 text-green-900 dark:text-green-100"
                                : "bg-accent"
                            }`}
                          >
                            <p className="text-sm">{msg.body}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                  <div className="border-t border-border/40 pt-3 mt-3">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Digite sua mensagem..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="min-h-[60px] resize-none"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <Button
                        className="h-auto"
                        onClick={sendMessage}
                        disabled={isSending || !newMessage.trim()}
                      >
                        {isSending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Selecione uma conversa para comecar</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
