"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageCircle,
  Send,
  Search,
  Loader2,
  User,
  ArrowLeft,
  RefreshCw,
  Globe,
  Phone,
  Check,
  CheckCheck,
  FileText,
  Mic,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Conversation {
  id: string;
  channel: "whatsapp" | "webchat";
  name: string;
  avatar: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  sessionId: string;
  chatId?: string;
  widgetName?: string;
}

interface Message {
  id: string;
  content: string;
  body?: string;
  isFromMe?: boolean;
  isFromVisitor?: boolean;
  isRead?: boolean;
  timestamp?: string;
  createdAt?: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaMimeType?: string | null;
  mediaDuration?: number | null;
  mediaFileName?: string | null;
}

interface InboxData {
  conversations: Conversation[];
  counts: {
    total: number;
    whatsapp: number;
    webchat: number;
  };
  unread: {
    total: number;
    whatsapp: number;
    webchat: number;
  };
}

export default function InboxPage() {
  const [data, setData] = useState<InboxData | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchInbox = useCallback(async () => {
    try {
      const response = await fetch(`/api/inbox?channel=${activeTab}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch {
      console.error("Erro ao carregar inbox");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  const fetchMessages = useCallback(async () => {
    if (!selectedConversation) return;

    try {
      let url = "";
      if (selectedConversation.channel === "whatsapp") {
        url = `/api/whatsapp/${selectedConversation.sessionId}/messages?chatId=${encodeURIComponent(selectedConversation.chatId || "")}&limit=100`;
      } else {
        url = `/api/webchat/sessions/${selectedConversation.sessionId}/messages`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setMessages(result.messages || []);
      }
    } catch {
      console.error("Erro ao carregar mensagens");
    }
  }, [selectedConversation]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages();
    }
  }, [selectedConversation, fetchMessages]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (selectedConversation) {
      pollIntervalRef.current = setInterval(() => {
        fetchMessages();
        fetchInbox();
      }, 3000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [selectedConversation, fetchMessages, fetchInbox]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setIsSending(true);
    try {
      let url = "";
      let body = {};

      if (selectedConversation.channel === "whatsapp") {
        url = `/api/whatsapp/${selectedConversation.sessionId}/messages`;
        body = {
          to: selectedConversation.chatId,
          message: newMessage,
        };
      } else {
        url = `/api/webchat/sessions/${selectedConversation.sessionId}/messages`;
        body = { content: newMessage };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Erro ao enviar mensagem");

      setNewMessage("");
      await fetchMessages();
    } catch {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setMobileView("chat");
  };

  const handleBackToList = () => {
    setMobileView("list");
  };

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

  const filteredConversations = data?.conversations.filter(
    (conv) =>
      conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const getChannelIcon = (channel: "whatsapp" | "webchat") => {
    if (channel === "whatsapp") {
      return <Phone className="h-3 w-3" />;
    }
    return <Globe className="h-3 w-3" />;
  };

  const getChannelColor = (channel: "whatsapp" | "webchat") => {
    if (channel === "whatsapp") {
      return "bg-green-500/10 text-green-600 border-green-500/20";
    }
    return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <h2 className="font-semibold text-lg">Caixa de Entrada</h2>
            <Button variant="ghost" size="icon" onClick={fetchInbox} className="h-8 w-8">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-3">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                Todos
                {data && data.unread.total > 0 && (
                  <Badge className="ml-1 h-5 min-w-[20px] bg-red-500">{data.unread.total}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex-1">
                <Phone className="h-3 w-3 mr-1" />
                WhatsApp
                {data && data.unread.whatsapp > 0 && (
                  <Badge className="ml-1 h-5 min-w-[20px] bg-green-500">{data.unread.whatsapp}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="webchat" className="flex-1">
                <Globe className="h-3 w-3 mr-1" />
                Site
                {data && data.unread.webchat > 0 && (
                  <Badge className="ml-1 h-5 min-w-[20px] bg-blue-500">{data.unread.webchat}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>

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

        {/* Lista de conversas */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-accent/50 transition-colors border-b border-border/20 ${
                  selectedConversation?.id === conv.id ? "bg-accent" : ""
                }`}
                onClick={() => handleSelectConversation(conv)}
              >
                <div className="relative">
                  <Avatar className="h-11 w-11 flex-shrink-0">
                    {conv.avatar && <AvatarImage src={conv.avatar} alt={conv.name} />}
                    <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 text-white">
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center ${
                      conv.channel === "whatsapp" ? "bg-green-500" : "bg-blue-500"
                    }`}
                  >
                    {getChannelIcon(conv.channel)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate text-sm">{conv.name}</p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatTime(conv.lastMessageTime)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage || "Sem mensagens"}
                    </p>
                    {conv.unreadCount > 0 && (
                      <Badge className={`h-5 min-w-[20px] flex items-center justify-center text-xs flex-shrink-0 ${
                        conv.channel === "whatsapp" ? "bg-green-500" : "bg-blue-500"
                      }`}>
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  {conv.widgetName && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      via {conv.widgetName}
                    </p>
                  )}
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
        {selectedConversation ? (
          <>
            {/* Chat header */}
            <div className="p-2 md:p-3 border-b border-border/40 bg-card/50 flex items-center gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 flex-shrink-0"
                onClick={handleBackToList}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-9 w-9 flex-shrink-0">
                {selectedConversation.avatar && (
                  <AvatarImage src={selectedConversation.avatar} alt={selectedConversation.name} />
                )}
                <AvatarFallback className="bg-gradient-to-br from-gray-500 to-gray-600 text-white">
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{selectedConversation.name}</p>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className={`text-[10px] h-4 ${getChannelColor(selectedConversation.channel)}`}>
                    {getChannelIcon(selectedConversation.channel)}
                    <span className="ml-1">
                      {selectedConversation.channel === "whatsapp" ? "WhatsApp" : "Site"}
                    </span>
                  </Badge>
                </div>
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
                    const timestamp = msg.timestamp || msg.createdAt || "";
                    const isFromMe = msg.isFromMe !== undefined ? msg.isFromMe : !msg.isFromVisitor;
                    const content = msg.body || msg.content || "";
                    const showDate =
                      index === 0 ||
                      formatDate(messages[index - 1].timestamp || messages[index - 1].createdAt || "") !==
                        formatDate(timestamp);

                    return (
                      <div key={msg.id}>
                        {showDate && (
                          <div className="flex justify-center my-3">
                            <span className="bg-accent text-[10px] px-3 py-1 rounded-full">
                              {formatDate(timestamp)}
                            </span>
                          </div>
                        )}
                        <div className={`flex ${isFromMe ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] md:max-w-[65%] p-2 rounded-lg shadow-sm ${
                              isFromMe
                                ? "bg-green-500/20 rounded-tr-none"
                                : "bg-card rounded-tl-none"
                            }`}
                          >
                            {/* Media Content */}
                            {msg.mediaUrl && msg.mediaType && (
                              <div className="mb-2">
                                {/* Image */}
                                {msg.mediaType === "image" && (
                                  <a href={msg.mediaUrl!} target="_blank" rel="noopener noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={msg.mediaUrl!}
                                      alt="Imagem"
                                      className="rounded-lg max-w-full max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        target.parentElement!.innerHTML = '<span class="text-xs text-muted-foreground">Erro ao carregar imagem</span>';
                                      }}
                                    />
                                  </a>
                                )}

                                {/* Sticker */}
                                {msg.mediaType === "sticker" && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={msg.mediaUrl}
                                    alt="Sticker"
                                    className="max-w-24 max-h-24"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                    }}
                                  />
                                )}

                                {/* Video */}
                                {msg.mediaType === "video" && (
                                  <video
                                    src={msg.mediaUrl}
                                    controls
                                    className="rounded-lg max-w-full max-h-48"
                                    onError={(e) => {
                                      const target = e.target as HTMLVideoElement;
                                      target.style.display = 'none';
                                      target.parentElement!.innerHTML += '<span class="text-xs text-muted-foreground">Erro ao carregar vídeo</span>';
                                    }}
                                  >
                                    Seu navegador não suporta vídeo.
                                  </video>
                                )}

                                {/* Audio / Voice Note (PTT) */}
                                {(msg.mediaType === "audio" || msg.mediaType === "ptt") && (
                                  <div className="flex items-center gap-2 bg-background/50 rounded-full px-3 py-2 min-w-[200px]">
                                    <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                      <Mic className="h-4 w-4 text-green-500" />
                                    </div>
                                    <audio
                                      src={msg.mediaUrl!}
                                      controls
                                      className="h-8 flex-1 min-w-[120px]"
                                      preload="metadata"
                                      onError={(e) => {
                                        const target = e.target as HTMLAudioElement;
                                        target.style.display = 'none';
                                        const span = document.createElement('span');
                                        span.className = 'text-xs text-muted-foreground';
                                        span.textContent = 'Erro ao carregar áudio';
                                        target.parentElement!.appendChild(span);
                                      }}
                                    />
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
                                    href={msg.mediaUrl!}
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

                            {/* Fallback for media without URL */}
                            {!msg.mediaUrl && msg.mediaType && !['reaction', 'deleted', 'poll', 'poll_vote', 'contact', 'contacts', 'location', 'live_location'].includes(msg.mediaType) && (
                              <div className="mb-2 p-2 bg-background/30 rounded-lg">
                                <p className="text-xs text-muted-foreground flex items-center gap-2">
                                  {(msg.mediaType === 'ptt' || msg.mediaType === 'audio') && <Mic className="h-4 w-4" />}
                                  {msg.mediaType === 'image' && <span>Imagem não disponível</span>}
                                  {msg.mediaType === 'video' && <span>Vídeo não disponível</span>}
                                  {(msg.mediaType === 'audio' || msg.mediaType === 'ptt') && <span>Áudio não disponível</span>}
                                  {msg.mediaType === 'document' && <span>Documento não disponível</span>}
                                  {msg.mediaType === 'sticker' && <span>Sticker não disponível</span>}
                                </p>
                              </div>
                            )}

                            {/* Text Content */}
                            {content && (
                              <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
                            )}

                            {/* Special message types without media */}
                            {!content && !msg.mediaUrl && msg.mediaType && ['reaction', 'deleted', 'poll', 'poll_vote', 'contact', 'contacts', 'location', 'live_location'].includes(msg.mediaType) && (
                              <p className="text-sm text-muted-foreground italic">
                                {msg.mediaType === 'reaction' && 'Reação'}
                                {msg.mediaType === 'deleted' && 'Mensagem apagada'}
                                {msg.mediaType === 'poll' && 'Enquete'}
                                {msg.mediaType === 'poll_vote' && 'Voto em enquete'}
                                {msg.mediaType === 'contact' && 'Contato compartilhado'}
                                {msg.mediaType === 'contacts' && 'Contatos compartilhados'}
                                {msg.mediaType === 'location' && 'Localização compartilhada'}
                                {msg.mediaType === 'live_location' && 'Localização ao vivo'}
                              </p>
                            )}

                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[9px] text-muted-foreground">
                                {formatTime(timestamp)}
                              </span>
                              {isFromMe && (
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
                <Textarea
                  placeholder="Digite uma mensagem..."
                  className="flex-1 text-sm min-h-[40px] max-h-[120px] resize-none"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={1}
                />
                <Button
                  size="icon"
                  className={`h-10 w-10 ${
                    selectedConversation.channel === "whatsapp"
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-blue-500 hover:bg-blue-600"
                  }`}
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
                Caixa de Entrada
              </h2>
              <p className="text-sm text-muted-foreground">
                Selecione uma conversa para começar
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
