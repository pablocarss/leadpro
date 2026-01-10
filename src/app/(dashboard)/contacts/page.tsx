"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, MoreHorizontal, Loader2, Pencil, Trash2, User, MessageCircle, Phone, Mail, Building2, Upload, Download, FileSpreadsheet, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  avatar: string | null;
  company: { name: string } | null;
  whatsappSession: { id: string; name: string; phone: string | null } | null;
  syncedFromWhatsapp: boolean;
  createdAt: string;
}

interface WhatsappSession {
  id: string;
  name: string;
  phone: string | null;
  status: string;
}

const initialFormData = {
  name: "",
  email: "",
  phone: "",
  position: "",
};

export default function ContactsPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [whatsappSessions, setWhatsappSessions] = useState<WhatsappSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [syncFilter, setSyncFilter] = useState<string>("all");
  const [formData, setFormData] = useState(initialFormData);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalContacts, setTotalContacts] = useState(0);
  const pageSize = 15;

  // Chat dialog
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
  const [contactForChat, setContactForChat] = useState<Contact | null>(null);

  const fetchWhatsappSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp");
      if (response.ok) {
        const data = await response.json();
        // API returns array directly, not { data: [...] }
        setWhatsappSessions(Array.isArray(data) ? data : (data.data || []));
      }
    } catch {
      // Silently fail
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("limit", pageSize.toString());
      if (search) params.set("search", search);
      if (sessionFilter && sessionFilter !== "all") params.set("whatsappSessionId", sessionFilter);
      if (syncFilter === "synced") params.set("syncedFromWhatsapp", "true");
      if (syncFilter === "manual") params.set("syncedFromWhatsapp", "false");

      const response = await fetch(`/api/contacts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data.data);
        setTotalPages(data.totalPages);
        setTotalContacts(data.total);
      }
    } catch {
      toast.error("Erro ao carregar contatos");
    } finally {
      setIsLoading(false);
    }
  }, [search, sessionFilter, syncFilter, currentPage]);

  useEffect(() => {
    fetchWhatsappSessions();
  }, [fetchWhatsappSessions]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, sessionFilter, syncFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = selectedContact ? `/api/contacts/${selectedContact.id}` : "/api/contacts";
      const method = selectedContact ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast.success(selectedContact ? "Contato atualizado!" : "Contato criado!");
      setIsOpen(false);
      setFormData(initialFormData);
      setSelectedContact(null);
      fetchContacts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar contato");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (contact: Contact) => {
    setSelectedContact(contact);
    setFormData({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      position: contact.position || "",
    });
    setIsOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedContact) return;

    try {
      const response = await fetch(`/api/contacts/${selectedContact.id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erro ao excluir contato");

      toast.success("Contato excluído!");
      setIsDeleteOpen(false);
      setSelectedContact(null);
      fetchContacts();
    } catch {
      toast.error("Erro ao excluir contato");
    }
  };

  const openNewDialog = () => {
    setSelectedContact(null);
    setFormData(initialFormData);
    setIsOpen(true);
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);

      const response = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error);
      }

      toast.success(`Importação concluída: ${data.imported} contatos importados, ${data.skipped} ignorados`);
      setIsImportOpen(false);
      setImportFile(null);
      fetchContacts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao importar contatos");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    window.open("/api/contacts/template", "_blank");
  };

  const connectedSessions = whatsappSessions.filter((s) => s.status === "CONNECTED");

  const handleStartChat = (contact: Contact) => {
    if (!contact.phone) {
      toast.error("Este contato não possui telefone cadastrado");
      return;
    }

    if (connectedSessions.length === 0) {
      toast.error("Nenhuma sessão do WhatsApp conectada");
      return;
    }

    if (connectedSessions.length === 1) {
      // Go directly to chat with the only connected session
      const chatId = contact.phone.replace(/\D/g, "") + "@s.whatsapp.net";
      router.push(`/chat?session=${connectedSessions[0].id}&contact=${encodeURIComponent(chatId)}`);
    } else {
      // Show dialog to select session
      setContactForChat(contact);
      setIsChatDialogOpen(true);
    }
  };

  const handleSelectSessionForChat = (sessionId: string) => {
    if (!contactForChat?.phone) return;

    const chatId = contactForChat.phone.replace(/\D/g, "") + "@s.whatsapp.net";
    router.push(`/chat?session=${sessionId}&contact=${encodeURIComponent(chatId)}`);
    setIsChatDialogOpen(false);
    setContactForChat(null);
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Contatos</h1>
          <p className="text-sm md:text-base text-muted-foreground">Gerencie seus contatos.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Importar Excel
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importar Contatos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Modelo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openNewDialog} className="bg-gradient-to-r from-black to-gray-700 dark:from-white dark:to-gray-300 dark:text-black w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Novo Contato
          </Button>
        </div>
      </div>

      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader className="p-3 md:p-6">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                className="pl-10 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={sessionFilter} onValueChange={setSessionFilter}>
                <SelectTrigger className="w-full sm:w-[180px] text-sm">
                  <SelectValue placeholder="Conexão WhatsApp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas conexões</SelectItem>
                  {whatsappSessions.map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-3 w-3" />
                        {session.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={syncFilter} onValueChange={setSyncFilter}>
                <SelectTrigger className="w-full sm:w-[150px] text-sm">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="synced">Sincronizados</SelectItem>
                  <SelectItem value="manual">Manuais</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-br from-black/10 to-gray-200 dark:from-white/10 dark:to-gray-800 flex items-center justify-center mb-4">
                <User className="h-7 w-7 md:h-8 md:w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base md:text-lg font-semibold">Nenhum contato cadastrado</h3>
              <p className="text-xs md:text-sm text-muted-foreground">Comece adicionando seu primeiro contato.</p>
            </div>
          ) : (
            <>
              {/* Mobile: Card List */}
              <div className="md:hidden space-y-3">
                {contacts.map((contact) => (
                  <div key={contact.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-background/50">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      {contact.avatar && <AvatarImage src={contact.avatar} alt={contact.name} />}
                      <AvatarFallback className="bg-gradient-to-br from-black to-gray-600 dark:from-white dark:to-gray-400 text-white dark:text-black text-xs">
                        {contact.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{contact.name}</p>
                          {contact.position && (
                            <p className="text-xs text-muted-foreground truncate">{contact.position}</p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {contact.phone && (
                              <DropdownMenuItem onClick={() => handleStartChat(contact)} className="text-green-600">
                                <Send className="mr-2 h-4 w-4" />
                                Iniciar Conversa
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleEdit(contact)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedContact(contact); setIsDeleteOpen(true); }} className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-2 space-y-1">
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span className="truncate">{contact.phone}</span>
                          </div>
                        )}
                        {contact.email && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}
                        {contact.company && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span className="truncate">{contact.company.name}</span>
                          </div>
                        )}
                        {contact.whatsappSession && (
                          <div className="flex items-center gap-2 text-xs text-green-600">
                            <MessageCircle className="h-3 w-3" />
                            <span className="truncate">{contact.whatsappSession.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Conexão</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              {contact.avatar && <AvatarImage src={contact.avatar} alt={contact.name} />}
                              <AvatarFallback className="bg-gradient-to-br from-black to-gray-600 dark:from-white dark:to-gray-400 text-white dark:text-black text-xs">
                                {contact.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{contact.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{contact.email || "-"}</TableCell>
                        <TableCell>{contact.phone || "-"}</TableCell>
                        <TableCell>{contact.position || "-"}</TableCell>
                        <TableCell>{contact.company?.name || "-"}</TableCell>
                        <TableCell>
                          {contact.whatsappSession ? (
                            <div className="flex items-center gap-1.5">
                              <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                              <span className="text-xs">{contact.whatsappSession.name}</span>
                            </div>
                          ) : contact.syncedFromWhatsapp ? (
                            <span className="text-xs text-muted-foreground">Sincronizado</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {contact.phone && (
                                <DropdownMenuItem onClick={() => handleStartChat(contact)} className="text-green-600">
                                  <Send className="mr-2 h-4 w-4" />
                                  Iniciar Conversa
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleEdit(contact)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedContact(contact); setIsDeleteOpen(true); }} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/40 mt-4">
                  <p className="text-sm text-muted-foreground order-2 sm:order-1">
                    Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalContacts)} de {totalContacts} contatos
                  </p>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          // Show first, last, current, and adjacent pages
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .map((page, index, arr) => (
                          <span key={page} className="flex items-center">
                            {index > 0 && arr[index - 1] !== page - 1 && (
                              <span className="px-2 text-muted-foreground">...</span>
                            )}
                            <Button
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          </span>
                        ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedContact ? "Editar Contato" : "Novo Contato"}</DialogTitle>
            <DialogDescription>Preencha as informações do contato.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="position">Cargo</Label>
                <Input id="position" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedContact ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Excluir Contato</DialogTitle>
            <DialogDescription>Tem certeza que deseja excluir &quot;{selectedContact?.name}&quot;?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} className="w-full sm:w-auto">Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { setIsImportOpen(open); if (!open) setImportFile(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Importar Contatos</DialogTitle>
            <DialogDescription>
              Importe contatos a partir de um arquivo Excel (.xlsx ou .xls).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="rounded-lg border-2 border-dashed border-border/60 p-6 text-center">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <div className="space-y-2">
                <Label htmlFor="import-file" className="cursor-pointer">
                  <span className="text-sm font-medium">
                    {importFile ? importFile.name : "Clique para selecionar arquivo"}
                  </span>
                </Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground">
                  Formatos suportados: .xlsx, .xls
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p className="font-medium mb-2">Colunas reconhecidas:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <strong>Nome</strong>: name, nome, contact, contato</li>
                <li>• <strong>Email</strong>: email, e-mail, mail</li>
                <li>• <strong>Telefone</strong>: phone, telefone, celular, whatsapp</li>
                <li>• <strong>Cargo</strong>: position, cargo, job, title</li>
                <li>• <strong>Empresa</strong>: company, empresa, organization</li>
              </ul>
              <Button variant="link" size="sm" className="px-0 mt-2 h-auto" onClick={downloadTemplate}>
                <Download className="mr-1 h-3 w-3" />
                Baixar modelo de exemplo
              </Button>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => { setIsImportOpen(false); setImportFile(null); }} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!importFile || isImporting} className="w-full sm:w-auto">
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Select Session for Chat Dialog */}
      <Dialog open={isChatDialogOpen} onOpenChange={setIsChatDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Selecionar Conexão</DialogTitle>
            <DialogDescription>
              Escolha qual conexão do WhatsApp usar para conversar com {contactForChat?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            {connectedSessions.map((session) => (
              <Button
                key={session.id}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => handleSelectSessionForChat(session.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{session.name}</p>
                    <p className="text-xs text-muted-foreground">{session.phone || "Sem número"}</p>
                  </div>
                </div>
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChatDialogOpen(false)} className="w-full">
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
