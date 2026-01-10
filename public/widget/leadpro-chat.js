(function() {
  'use strict';

  // Configuração
  const LEADPRO_API = window.LEADPRO_API_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : window.location.origin);

  // Obter widgetId do script tag
  const scriptTag = document.currentScript;
  const widgetId = scriptTag?.getAttribute('data-widget-id');

  if (!widgetId) {
    console.error('LeadPro Chat: data-widget-id não encontrado');
    return;
  }

  // Estado
  let config = null;
  let session = null;
  let messages = [];
  let isOpen = false;
  let isLoading = false;
  let pollInterval = null;

  // Gerar ou recuperar visitorId
  function getVisitorId() {
    let visitorId = localStorage.getItem('leadpro_visitor_id');
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('leadpro_visitor_id', visitorId);
    }
    return visitorId;
  }

  // Criar estilos
  function injectStyles(primaryColor, position) {
    const style = document.createElement('style');
    style.textContent = `
      #leadpro-chat-widget {
        --lp-primary: ${primaryColor};
        --lp-primary-dark: ${adjustColor(primaryColor, -20)};
        position: fixed;
        bottom: 20px;
        ${position}: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      }

      #leadpro-chat-button {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--lp-primary);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: transform 0.2s, box-shadow 0.2s;
      }

      #leadpro-chat-button:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }

      #leadpro-chat-button svg {
        width: 28px;
        height: 28px;
        fill: white;
      }

      #leadpro-chat-window {
        display: none;
        position: absolute;
        bottom: 70px;
        ${position}: 0;
        width: 360px;
        height: 500px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        flex-direction: column;
      }

      #leadpro-chat-window.open {
        display: flex;
      }

      #leadpro-chat-header {
        background: var(--lp-primary);
        color: white;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 12px;
      }

      #leadpro-chat-header-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #leadpro-chat-header-avatar svg {
        width: 24px;
        height: 24px;
        fill: white;
      }

      #leadpro-chat-header-info h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      #leadpro-chat-header-info p {
        margin: 2px 0 0;
        font-size: 12px;
        opacity: 0.9;
      }

      #leadpro-chat-close {
        margin-left: auto;
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      #leadpro-chat-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }

      #leadpro-chat-close svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }

      #leadpro-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #f5f5f5;
      }

      .leadpro-message {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.4;
        word-wrap: break-word;
      }

      .leadpro-message.visitor {
        background: var(--lp-primary);
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 4px;
      }

      .leadpro-message.operator {
        background: white;
        color: #333;
        align-self: flex-start;
        border-bottom-left-radius: 4px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      .leadpro-message-time {
        font-size: 10px;
        opacity: 0.7;
        margin-top: 4px;
      }

      #leadpro-chat-input-container {
        padding: 12px 16px;
        background: white;
        border-top: 1px solid #e5e5e5;
        display: flex;
        gap: 8px;
      }

      #leadpro-chat-input {
        flex: 1;
        border: 1px solid #e5e5e5;
        border-radius: 24px;
        padding: 10px 16px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      }

      #leadpro-chat-input:focus {
        border-color: var(--lp-primary);
      }

      #leadpro-chat-send {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--lp-primary);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      #leadpro-chat-send:hover {
        background: var(--lp-primary-dark);
      }

      #leadpro-chat-send:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      #leadpro-chat-send svg {
        width: 18px;
        height: 18px;
        fill: white;
      }

      #leadpro-chat-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        color: #666;
      }

      @media (max-width: 480px) {
        #leadpro-chat-window {
          width: calc(100vw - 40px);
          height: calc(100vh - 100px);
          bottom: 70px;
          ${position}: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Ajustar cor (escurecer/clarear)
  function adjustColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
  }

  // Criar HTML do widget
  function createWidget() {
    const widget = document.createElement('div');
    widget.id = 'leadpro-chat-widget';
    widget.innerHTML = `
      <button id="leadpro-chat-button" aria-label="Abrir chat">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </button>
      <div id="leadpro-chat-window">
        <div id="leadpro-chat-header">
          <div id="leadpro-chat-header-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
          </div>
          <div id="leadpro-chat-header-info">
            <h3>${config?.name || 'Suporte'}</h3>
            <p>Online agora</p>
          </div>
          <button id="leadpro-chat-close" aria-label="Fechar chat">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <div id="leadpro-chat-messages">
          <div id="leadpro-chat-loading">Carregando...</div>
        </div>
        <div id="leadpro-chat-input-container">
          <input type="text" id="leadpro-chat-input" placeholder="Digite sua mensagem..." />
          <button id="leadpro-chat-send" aria-label="Enviar mensagem">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(widget);

    // Event listeners
    document.getElementById('leadpro-chat-button').addEventListener('click', toggleChat);
    document.getElementById('leadpro-chat-close').addEventListener('click', toggleChat);
    document.getElementById('leadpro-chat-send').addEventListener('click', sendMessage);
    document.getElementById('leadpro-chat-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  // Toggle chat
  function toggleChat() {
    isOpen = !isOpen;
    const window = document.getElementById('leadpro-chat-window');
    window.classList.toggle('open', isOpen);

    if (isOpen && !session) {
      initSession();
    }

    if (isOpen) {
      startPolling();
    } else {
      stopPolling();
    }
  }

  // Iniciar sessão
  async function initSession() {
    isLoading = true;
    try {
      const response = await fetch(`${LEADPRO_API}/api/webchat/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetId,
          visitorId: getVisitorId(),
          pageUrl: window.location.href,
          userAgent: navigator.userAgent,
        }),
      });

      if (response.ok) {
        session = await response.json();
        messages = session.messages || [];
        renderMessages();
      } else {
        showError('Erro ao conectar ao chat');
      }
    } catch (error) {
      console.error('LeadPro Chat:', error);
      showError('Erro de conexão');
    }
    isLoading = false;
  }

  // Renderizar mensagens
  function renderMessages() {
    const container = document.getElementById('leadpro-chat-messages');
    container.innerHTML = messages.map(msg => `
      <div class="leadpro-message ${msg.isFromVisitor ? 'visitor' : 'operator'}">
        ${escapeHtml(msg.content)}
        <div class="leadpro-message-time">${formatTime(msg.createdAt)}</div>
      </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
  }

  // Enviar mensagem
  async function sendMessage() {
    const input = document.getElementById('leadpro-chat-input');
    const content = input.value.trim();
    if (!content || !session) return;

    input.value = '';
    const sendBtn = document.getElementById('leadpro-chat-send');
    sendBtn.disabled = true;

    try {
      const response = await fetch(`${LEADPRO_API}/api/webchat/sessions/${session.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          visitorId: getVisitorId(),
        }),
      });

      if (response.ok) {
        const message = await response.json();
        messages.push(message);
        renderMessages();
      }
    } catch (error) {
      console.error('LeadPro Chat:', error);
    }
    sendBtn.disabled = false;
  }

  // Polling para novas mensagens
  function startPolling() {
    if (pollInterval) return;
    pollInterval = setInterval(async () => {
      if (!session) return;

      try {
        const lastMessage = messages[messages.length - 1];
        const since = lastMessage?.createdAt || '';
        const response = await fetch(
          `${LEADPRO_API}/api/webchat/sessions/${session.id}/messages?visitorId=${getVisitorId()}&since=${encodeURIComponent(since)}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.messages?.length > 0) {
            messages.push(...data.messages);
            renderMessages();
          }
        }
      } catch (error) {
        console.error('LeadPro Chat polling:', error);
      }
    }, 3000);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  // Utilitários
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatTime(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function showError(message) {
    const container = document.getElementById('leadpro-chat-messages');
    container.innerHTML = `<div id="leadpro-chat-loading">${message}</div>`;
  }

  // Inicialização
  async function init() {
    try {
      const response = await fetch(`${LEADPRO_API}/api/webchat/widget/${widgetId}`);
      if (response.ok) {
        config = await response.json();
        injectStyles(config.primaryColor, config.position);
        createWidget();
      } else {
        console.error('LeadPro Chat: Widget não encontrado');
      }
    } catch (error) {
      console.error('LeadPro Chat:', error);
    }
  }

  // Iniciar quando DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
