"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageCircle,
  Send,
  Search,
  Phone,
  MoreVertical,
  Smile,
  Paperclip,
  Check,
  CheckCheck,
  User,
  ArrowLeft,
  RefreshCw,
  Users,
  Settings,
  Loader2,
  FileText,
  Mic,
  Download,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface WhatsappSession {
  id: string;
  name: string;
  phone: string | null;
  status: string;
}

interface Chat {
  chatId: string;
  name: string;
  avatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isGroup: boolean;
}

interface Message {
  id: string;
  messageId: string | null;
  chatId: string;
  from: string;
  to: string;
  body: string;
  mediaUrl: string | null;
  mediaType: string | null;
  mediaMimeType: string | null;
  mediaDuration: number | null;
  mediaFileName: string | null;
  isFromMe: boolean;
  isRead: boolean;
  timestamp: string;
}

interface Pipeline {
  id: string;
  name: string;
  color: string;
  stages: { id: string; name: string; color: string; order: number }[];
}

const initialPipelineForm = {
  pipelineId: "",
  stageId: "",
  title: "",
  value: "",
  notes: "",
};

function ChatPageContent() {
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("session");
  const urlContactId = searchParams.get("contact");

  const [sessions, setSessions] = useState<WhatsappSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<WhatsappSession | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [newChatNumber, setNewChatNumber] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [initialContactHandled, setInitialContactHandled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pipeline dialog state
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const [isPipelineSubmitting, setIsPipelineSubmitting] = useState(false);
  const [pipelineForm, setPipelineForm] = useState(initialPipelineForm);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp");
      if (response.ok) {
        const data = await response.json();
        const connectedSessions = data.filter((s: WhatsappSession) => s.status === "CONNECTED");
        setSessions(connectedSessions);

        // Check if we have a session from URL
        if (urlSessionId && !selectedSession) {
          const urlSession = connectedSessions.find((s: WhatsappSession) => s.id === urlSessionId);
          if (urlSession) {
            setSelectedSession(urlSession);
            return;
          }
        }

        if (connectedSessions.length > 0 && !selectedSession) {
          setSelectedSession(connectedSessions[0]);
        }
      }
    } catch {
      console.error("Error fetching sessions");
    } finally {
      setIsLoading(false);
    }
  }, [selectedSession, urlSessionId]);

  const fetchChats = useCallback(async () => {
    if (!selectedSession) return;

    try {
      const response = await fetch(`/api/whatsapp/${selectedSession.id}/conversations`);
      if (response.ok) {
        const data = await response.json();
        setChats(data);
      }
    } catch {
      console.error("Error fetching chats");
    }
  }, [selectedSession]);

  const fetchPipelines = useCallback(async () => {
    try {
      const response = await fetch("/api/pipelines?includeStages=true");
      if (response.ok) {
        const data = await response.json();
        setPipelines(data.data);
      }
    } catch {
      console.error("Error fetching pipelines");
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!selectedSession || !selectedChat) return;

    try {
      const response = await fetch(
        `/api/whatsapp/${selectedSession.id}/messages?chatId=${encodeURIComponent(selectedChat.chatId)}&limit=100`
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages);
      }
    } catch {
      console.error("Error fetching messages");
    }
  }, [selectedSession, selectedChat]);

  const markAsRead = useCallback(async () => {
    if (!selectedSession || !selectedChat) return;

    try {
      await fetch(`/api/whatsapp/${selectedSession.id}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: selectedChat.chatId }),
      });
    } catch {
      // Ignore errors
    }
  }, [selectedSession, selectedChat]);

  useEffect(() => {
    fetchSessions();
    fetchPipelines();
  }, [fetchSessions, fetchPipelines]);

  useEffect(() => {
    if (selectedSession) {
      fetchChats();
    }
  }, [selectedSession, fetchChats]);

  useEffect(() => {
    if (selectedChat) {
      fetchMessages();
      markAsRead();
    }
  }, [selectedChat, fetchMessages, markAsRead]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (selectedSession && selectedChat) {
      pollIntervalRef.current = setInterval(() => {
        fetchMessages();
        fetchChats();
      }, 3000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [selectedSession, selectedChat, fetchMessages, fetchChats]);

  // Handle URL parameters to open a specific chat
  useEffect(() => {
    if (urlContactId && selectedSession && chats.length >= 0 && !initialContactHandled) {
      setInitialContactHandled(true);

      // Check if chat already exists
      const existingChat = chats.find((c) => c.chatId === urlContactId);
      if (existingChat) {
        setSelectedChat(existingChat);
        setMobileView("chat");
      } else {
        // Create a new chat entry
        const phoneNumber = urlContactId.replace("@s.whatsapp.net", "");
        const newChat: Chat = {
          chatId: urlContactId,
          name: phoneNumber,
          avatar: null,
          lastMessage: "",
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0,
          isGroup: false,
        };
        setChats((prev) => [newChat, ...prev]);
        setSelectedChat(newChat);
        setMobileView("chat");
      }
    }
  }, [urlContactId, selectedSession, chats, initialContactHandled]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSession || !selectedChat) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/whatsapp/${selectedSession.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: selectedChat.chatId,
          message: newMessage,
        }),
      });

      if (!response.ok) throw new Error("Erro ao enviar mensagem");

      setNewMessage("");
      await fetchMessages();
      await fetchChats();
    } catch {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  const startNewChat = () => {
    if (!newChatNumber.trim()) return;

    const chatId = newChatNumber.replace(/\D/g, "") + "@s.whatsapp.net";
    const newChat: Chat = {
      chatId,
      name: newChatNumber,
      avatar: null,
      lastMessage: "",
      lastMessageTime: new Date().toISOString(),
      unreadCount: 0,
      isGroup: false,
    };

    setChats([newChat, ...chats]);
    setSelectedChat(newChat);
    setMobileView("chat");
    setNewChatNumber("");
  };

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setMobileView("chat");
  };

  const handleBackToList = () => {
    setMobileView("list");
  };

  const openPipelineDialog = () => {
    if (!selectedChat) return;

    const contactName = selectedChat.name || selectedChat.chatId.replace("@s.whatsapp.net", "");
    setPipelineForm({
      ...initialPipelineForm,
      title: contactName,
    });
    setIsPipelineOpen(true);
  };

  const handleAddToPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipelineForm.pipelineId || !pipelineForm.stageId) {
      toast.error("Selecione a pipeline e o estágio");
      return;
    }

    setIsPipelineSubmitting(true);
    try {
      // First, create or find the contact
      const phoneNumber = selectedChat?.chatId.replace("@s.whatsapp.net", "") || "";
      const contactName = selectedChat?.name || phoneNumber;

      // Check if contact exists
      let contactId: string | null = null;
      const contactsRes = await fetch(`/api/contacts?search=${encodeURIComponent(phoneNumber)}`);
      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        const existingContact = contactsData.data.find(
          (c: { phone?: string }) => c.phone?.replace(/\D/g, "") === phoneNumber.replace(/\D/g, "")
        );
        if (existingContact) {
          contactId = existingContact.id;
        }
      }

      // Create contact if not exists
      if (!contactId) {
        const createContactRes = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: contactName,
            phone: phoneNumber,
          }),
        });
        if (createContactRes.ok) {
          const newContact = await createContactRes.json();
          contactId = newContact.id;
        }
      }

      // Add to pipeline
      const response = await fetch(`/api/pipelines/${pipelineForm.pipelineId}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: pipelineForm.title,
          stageId: pipelineForm.stageId,
          value: pipelineForm.value ? Number(pipelineForm.value) : null,
          notes: pipelineForm.notes || null,
          contactId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success("Contato adicionado à pipeline!");
      setIsPipelineOpen(false);
      setPipelineForm(initialPipelineForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar à pipeline");
    } finally {
      setIsPipelineSubmitting(false);
    }
  };

  const selectedPipeline = pipelines.find((p) => p.id === pipelineForm.pipelineId);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hoje";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ontem";
    } else {
      return date.toLocaleDateString("pt-BR");
    }
  };

  const filteredChats = chats.filter(
    (chat) =>
      chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.chatId.includes(searchQuery)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-4">
        <MessageCircle className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground mb-4" />
        <h2 className="text-lg md:text-xl font-semibold mb-2 text-center">Nenhuma sessão conectada</h2>
        <p className="text-muted-foreground mb-4 text-center text-sm md:text-base">
          Conecte uma sessão do WhatsApp para começar a conversar.
        </p>
        <Button asChild>
          <a href="/integrations">Ir para Integrações</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] bg-background rounded-lg border border-border/40 overflow-hidden">
      {/* Sidebar - Lista de conversas */}
      <div
        className={`
          ${mobileView === "list" ? "flex" : "hidden"}
          md:flex
          flex-col
          w-full md:w-[320px] lg:w-[380px]
          h-full
          border-r border-border/40
          flex-shrink-0
        `}
      >
        {/* Header */}
        <div className="p-3 border-b border-border/40 bg-card/50 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-green-500 to-green-600 text-white">
                  <MessageCircle className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <Select
                  value={selectedSession?.id}
                  onValueChange={(value) => {
                    const session = sessions.find((s) => s.id === value);
                    if (session) {
                      setSelectedSession(session);
                      setSelectedChat(null);
                      setMessages([]);
                    }
                  }}
                >
                  <SelectTrigger className="h-auto border-0 p-0 font-medium text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.name} {session.phone && `(${session.phone})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={fetchChats} className="h-8 w-8">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href="/integrations">
                      <Settings className="mr-2 h-4 w-4" />
                      Configurações
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/contacts">
                      <Users className="mr-2 h-4 w-4" />
                      Contatos
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar conversa..."
              className="pl-9 bg-accent/50 text-sm h-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* New chat input */}
        <div className="p-2 border-b border-border/40 flex gap-2 flex-shrink-0">
          <Input
            placeholder="Novo número (5511999999999)"
            value={newChatNumber}
            onChange={(e) => setNewChatNumber(e.target.value)}
            className="text-sm h-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                startNewChat();
              }
            }}
          />
          <Button size="sm" onClick={startNewChat} disabled={!newChatNumber.trim()} className="h-9 px-3">
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <div
                key={chat.chatId}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/20 ${
                  selectedChat?.chatId === chat.chatId ? "bg-accent" : ""
                }`}
                onClick={() => handleSelectChat(chat)}
              >
                <Avatar className="h-11 w-11 flex-shrink-0">
                  {chat.avatar && (
                    <AvatarImage src={chat.avatar} alt={chat.name} />
                  )}
                  <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 text-white">
                    {chat.isGroup ? (
                      <Users className="h-5 w-5" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate text-sm">{chat.name}</p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatTime(chat.lastMessageTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">
                      {chat.lastMessage || "Sem mensagens"}
                    </p>
                    {chat.unreadCount > 0 && (
                      <Badge className="bg-green-500 hover:bg-green-600 text-white h-5 min-w-[20px] flex items-center justify-center text-xs flex-shrink-0">
                        {chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div
        className={`
          ${mobileView === "chat" ? "flex" : "hidden"}
          md:flex
          flex-col
          flex-1
          h-full
          min-w-0
        `}
      >
        {selectedChat ? (
          <>
            {/* Chat header */}
            <div className="p-2 md:p-3 border-b border-border/40 bg-card/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8 flex-shrink-0"
                  onClick={handleBackToList}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-9 w-9 flex-shrink-0">
                  {selectedChat.avatar && (
                    <AvatarImage src={selectedChat.avatar} alt={selectedChat.name} />
                  )}
                  <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 text-white">
                    {selectedChat.isGroup ? (
                      <Users className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{selectedChat.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{selectedChat.chatId}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-8 w-8">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-8 w-8">
                  <Search className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={openPipelineDialog}>
                      <GitBranch className="mr-2 h-4 w-4" />
                      Adicionar à Pipeline
                    </DropdownMenuItem>
                    <DropdownMenuItem>Ver contato</DropdownMenuItem>
                    <DropdownMenuItem>Limpar conversa</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-3 md:p-4 bg-accent/10"
            >
              <div className="space-y-2 max-w-3xl mx-auto">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const showDate =
                      index === 0 ||
                      formatDate(messages[index - 1].timestamp) !== formatDate(msg.timestamp);

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-3">
                            <span className="bg-accent text-[10px] px-3 py-1 rounded-full">
                              {formatDate(msg.timestamp)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${msg.isFromMe ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] md:max-w-[65%] p-2 rounded-lg shadow-sm ${
                              msg.isFromMe
                                ? "bg-green-500/20 rounded-tr-none"
                                : "bg-card rounded-tl-none"
                            }`}
                          >
                            {/* Media Content */}
                            {msg.mediaUrl && msg.mediaType && (
                              <div className="mb-2">
                                {/* Image */}
                                {msg.mediaType === "image" && (
                                  <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={msg.mediaUrl}
                                      alt="Imagem"
                                      className="rounded-lg max-w-full max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    />
                                  </a>
                                )}

                                {/* Sticker */}
                                {msg.mediaType === "sticker" && (
                                  <img
                                    src={msg.mediaUrl}
                                    alt="Sticker"
                                    className="max-w-24 max-h-24"
                                  />
                                )}

                                {/* Video */}
                                {msg.mediaType === "video" && (
                                  <video
                                    src={msg.mediaUrl}
                                    controls
                                    className="rounded-lg max-w-full max-h-48"
                                  >
                                    Seu navegador não suporta vídeo.
                                  </video>
                                )}

                                {/* Audio / Voice Note (PTT) */}
                                {(msg.mediaType === "audio" || msg.mediaType === "ptt") && (
                                  <div className="flex items-center gap-2 bg-background/50 rounded-full px-2 py-1.5 min-w-[160px]">
                                    <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                      <Mic className="h-4 w-4 text-green-500" />
                                    </div>
                                    <audio
                                      src={msg.mediaUrl}
                                      controls
                                      className="h-7 flex-1 min-w-0"
                                    >
                                      Seu navegador não suporta áudio.
                                    </audio>
                                    {msg.mediaDuration && (
                                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                        {Math.floor(msg.mediaDuration / 60)}:{String(msg.mediaDuration % 60).padStart(2, '0')}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Document */}
                                {msg.mediaType === "document" && (
                                  <a
                                    href={msg.mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-background/50 rounded-lg p-2 hover:bg-background/70 transition-colors"
                                  >
                                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                      <FileText className="h-4 w-4 text-blue-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-medium truncate">
                                        {msg.mediaFileName || "Documento"}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        {msg.mediaMimeType || "Arquivo"}
                                      </p>
                                    </div>
                                    <Download className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Text Content */}
                            {msg.body && (
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                            )}

                            {/* Timestamp and Read Status */}
                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[9px] text-muted-foreground">
                                {formatTime(msg.timestamp)}
                              </span>
                              {msg.isFromMe && (
                                msg.isRead ? (
                                  <CheckCheck className="h-3 w-3 text-blue-500" />
                                ) : (
                                  <Check className="h-3 w-3 text-muted-foreground" />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message input */}
            <div className="p-2 md:p-3 border-t border-border/40 bg-card/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-9 w-9">
                  <Smile className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-9 w-9">
                  <Paperclip className="h-5 w-5" />
                </Button>
                <Input
                  placeholder="Digite uma mensagem..."
                  className="flex-1 text-sm h-10"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <Button
                  size="icon"
                  className="bg-green-500 hover:bg-green-600 h-10 w-10"
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
          <div className="flex-1 flex flex-col items-center justify-center bg-accent/20 p-4">
            <div className="text-center">
              <MessageCircle className="h-20 w-20 md:h-32 md:w-32 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="text-xl md:text-2xl font-light text-muted-foreground mb-2">
                LeadPro WhatsApp
              </h2>
              <p className="text-sm text-muted-foreground">
                Selecione uma conversa para começar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dialog Adicionar à Pipeline */}
      <Dialog open={isPipelineOpen} onOpenChange={setIsPipelineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar à Pipeline</DialogTitle>
            <DialogDescription>
              Adicione este contato a uma pipeline de vendas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddToPipeline}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="pipelineId">Pipeline *</Label>
                <Select
                  value={pipelineForm.pipelineId}
                  onValueChange={(value) =>
                    setPipelineForm({ ...pipelineForm, pipelineId: value, stageId: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: pipeline.color }}
                          />
                          {pipeline.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPipeline && (
                <div className="grid gap-2">
                  <Label htmlFor="stageId">Estágio *</Label>
                  <Select
                    value={pipelineForm.stageId}
                    onValueChange={(value) =>
                      setPipelineForm({ ...pipelineForm, stageId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um estágio" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedPipeline.stages
                        .sort((a, b) => a.order - b.order)
                        .map((stage) => (
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
              )}

              <div className="grid gap-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={pipelineForm.title}
                  onChange={(e) =>
                    setPipelineForm({ ...pipelineForm, title: e.target.value })
                  }
                  placeholder="Nome do lead"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="value">Valor Estimado</Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  value={pipelineForm.value}
                  onChange={(e) =>
                    setPipelineForm({ ...pipelineForm, value: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={pipelineForm.notes}
                  onChange={(e) =>
                    setPipelineForm({ ...pipelineForm, notes: e.target.value })
                  }
                  placeholder="Informações adicionais"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPipelineOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPipelineSubmitting}>
                {isPipelineSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
