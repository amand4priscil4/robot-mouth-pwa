import React, { useState, useEffect, useRef } from 'react';

// ==================== SERVIÇO TTS COMPLETO ====================
class RobotTTSService {
  constructor() {
    this.robotUrl = 'https://robot-mouth-pwa.vercel.app';
    this.isConnected = false;
    this.maxRetries = 3;
    this.timeout = 5000;
  }

  async checkConnection() {
    try {
      console.log('🔍 Verificando conexão com robô...');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.robotUrl}/api/health`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      this.isConnected = response.ok;

      if (this.isConnected) {
        console.log('✅ Robô conectado e funcionando');
      } else {
        console.log('❌ Robô não responde adequadamente');
      }

      return this.isConnected;
    } catch (error) {
      console.log('❌ Erro na conexão:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  async speak(text, config = {}) {
    if (!text || text.trim().length === 0) {
      console.warn('⚠️ Texto vazio, ignorando...');
      return false;
    }

    const cleanText = this.cleanText(text);
    const payload = {
      text: cleanText,
      config: {
        rate: config.rate || 0.85,
        pitch: config.pitch || 0.8,
        volume: config.volume || 1.0
      },
      timestamp: new Date().toISOString(),
      source: 'edu-ardu-frontend'
    };

    console.log(`🎤 Enviando para robô: "${cleanText.substring(0, 50)}..."`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.robotUrl}/api/speak`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'EduArdu-Frontend/1.0'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Sucesso na tentativa ${attempt}:`, result.message);
          return true;
        } else {
          console.warn(`❌ HTTP ${response.status} na tentativa ${attempt}`);
        }
      } catch (error) {
        console.warn(`❌ Tentativa ${attempt} falhou:`, error.message);

        if (attempt < this.maxRetries) {
          const delay = 1000 * attempt;
          console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
          await this.sleep(delay);
        }
      }
    }

    console.error('❌ Todas as tentativas falharam');
    return false;
  }

  async stop() {
    try {
      console.log('🛑 Enviando comando STOP para robô...');
      const response = await fetch(`${this.robotUrl}/api/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        console.log('✅ Comando STOP enviado com sucesso');
        return true;
      }
    } catch (error) {
      console.warn('❌ Erro ao enviar STOP:', error.message);
    }
    return false;
  }

  cleanText(text) {
    return (
      text
        // Remove emojis
        .replace(
          /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
          ''
        )
        // Remove markdown
        .replace(/[*_`#]/g, '')
        // Normaliza espaços
        .replace(/\s+/g, ' ')
        // Remove quebras excessivas
        .replace(/\n+/g, '. ')
        .replace(/[.]{2,}/g, '.')
        .trim()
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  estimateSpeechDuration(text) {
    const words = text.split(' ').length;
    const wpm = 150; // palavras por minuto
    const duration = (words / wpm) * 60 * 1000; // em ms
    return Math.min(Math.max(duration, 2000), 20000); // entre 2s e 20s
  }
}

// ==================== HOOK PERSONALIZADO ====================
function useRobotTTS() {
  const [ttsService] = useState(() => new RobotTTSService());
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [lastMessage, setLastMessage] = useState('');

  const checkConnection = async () => {
    const connected = await ttsService.checkConnection();
    setIsConnected(connected);
    if (!connected) {
      setError('Robô desconectado');
    } else {
      setError('');
    }
    return connected;
  };

  const speak = async (text, config) => {
    if (!text) return false;

    setIsSpeaking(true);
    setError('');
    setLastMessage(text);

    const success = await ttsService.speak(text, config);

    if (success) {
      const duration = ttsService.estimateSpeechDuration(text);
      setTimeout(() => {
        setIsSpeaking(false);
      }, duration);
    } else {
      setIsSpeaking(false);
      setError('Falha ao enviar para robô');
    }

    return success;
  };

  const stop = async () => {
    const stopped = await ttsService.stop();
    setIsSpeaking(false);
    if (stopped) {
      setError('');
    }
    return stopped;
  };

  const repeat = async config => {
    if (lastMessage) {
      return await speak(lastMessage, config);
    }
    return false;
  };

  return {
    isConnected,
    isSpeaking,
    error,
    lastMessage,
    checkConnection,
    speak,
    stop,
    repeat
  };
}

// ==================== COMPONENTE PRINCIPAL ====================
const ChatAIWithRobotTTS = () => {
  // Estados do chat
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId] = useState(() => 'session_' + Math.random().toString(36).substr(2, 9));

  // Estados TTS
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceConfig, setVoiceConfig] = useState({
    rate: 0.85,
    pitch: 0.8,
    volume: 1.0
  });

  // Hooks
  const robot = useRobotTTS();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Verificar conexão robô quando abrir
  useEffect(() => {
    if (isOpen && ttsEnabled) {
      robot.checkConnection();
      const interval = setInterval(robot.checkConnection, 30000); // a cada 30s
      return () => clearInterval(interval);
    }
  }, [isOpen, ttsEnabled]);

  // Mensagem de boas vindas
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = {
        id: 'welcome',
        text: '👋 Olá! Eu sou sua assistente de IA do Edu-Ardu. Posso ajudar com dúvidas sobre robótica, programação, eletrônica e muito mais. Minhas respostas serão faladas pelo robô automaticamente!',
        sender: 'ai',
        timestamp: new Date(),
        type: 'welcome'
      };
      setMessages([welcomeMessage]);

      // Fala mensagem de boas vindas
      if (ttsEnabled) {
        setTimeout(() => {
          robot.speak(welcomeMessage.text, voiceConfig);
        }, 1000);
      }
    }
  }, [isOpen]);

  // ==================== FUNÇÃO PRINCIPAL DE CHAT ====================
  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: currentMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = currentMessage;
    setCurrentMessage('');
    setIsTyping(true);

    try {
      // Chama sua API de IA existente
      const response = await fetch('http://localhost:3000/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageText,
          sessionId: sessionId,
          context: 'robotics_education'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const aiMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'ai',
        timestamp: new Date(),
        model: data.model || 'AI Assistant',
        ttsStatus: 'pending'
      };

      setMessages(prev => [...prev, aiMessage]);

      // 🤖 ENVIA PARA ROBÔ FALAR (FRONTEND DIRETO)
      if (ttsEnabled && data.response) {
        console.log('🎤 Enviando resposta da IA para robô...');
        const ttsSuccess = await robot.speak(data.response, voiceConfig);

        // Atualiza status na mensagem
        setMessages(prev =>
          prev.map(msg =>
            msg.id === aiMessage.id ? { ...msg, ttsStatus: ttsSuccess ? 'sent' : 'failed' } : msg
          )
        );

        if (ttsSuccess) {
          console.log('✅ Robô está falando a resposta da IA');
        } else {
          console.log('❌ Falha ao enviar para robô');
        }
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);

      const errorMessage = {
        id: Date.now() + 1,
        text: 'Desculpe, houve um erro ao processar sua mensagem. Verifique sua conexão e tente novamente.',
        sender: 'ai',
        timestamp: new Date(),
        type: 'error'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // ==================== FUNÇÕES DE CONTROLE ====================
  const clearChat = () => {
    setMessages([]);
    robot.stop();
  };

  const testRobot = async () => {
    const testMessage =
      'Olá! Este é um teste do sistema de voz do robô Edu-Ardu. Estou funcionando perfeitamente e pronto para ajudar com suas dúvidas sobre robótica e programação!';
    await robot.speak(testMessage, voiceConfig);
  };

  const formatTimestamp = timestamp => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTTSIcon = ttsStatus => {
    switch (ttsStatus) {
      case 'sent':
        return '🔊';
      case 'failed':
        return '❌';
      case 'pending':
        return '⏳';
      default:
        return '';
    }
  };

  // ==================== INTERFACE JSX ====================
  return (
    <>
      {/* Botão flutuante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(45deg, #2196F3, #21CBF3)',
            color: 'white',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(33, 150, 243, 0.4)',
            zIndex: 1000,
            transition: 'all 0.3s ease'
          }}
          onMouseOver={e => {
            e.target.style.transform = 'scale(1.1)';
            e.target.style.boxShadow = '0 6px 20px rgba(33, 150, 243, 0.6)';
          }}
          onMouseOut={e => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 15px rgba(33, 150, 243, 0.4)';
          }}
        >
          💬
        </button>
      )}

      {/* Chat drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: isOpen ? 0 : '-450px',
          width: '450px',
          height: '100vh',
          background: 'white',
          boxShadow: '-5px 0 20px rgba(0,0,0,0.1)',
          transition: 'right 0.3s ease',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #2196F3, #1976D2)',
            color: 'white',
            padding: '20px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}
              >
                🤖
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px' }}>IA + Robô Edu-Ardu</h3>
                <div style={{ fontSize: '12px', opacity: 0.9, marginTop: '2px' }}>
                  <span style={{ marginRight: '10px' }}>
                    {robot.isConnected ? '✅ Robô conectado' : '❌ Robô offline'}
                  </span>
                  {robot.isSpeaking && '🗣️ Falando'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  width: '35px',
                  height: '35px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
                title="Configurações TTS"
              >
                ⚙️
              </button>

              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  width: '35px',
                  height: '35px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Erro TTS */}
        {robot.error && (
          <div
            style={{
              background: '#fff3cd',
              color: '#856404',
              padding: '10px 20px',
              borderBottom: '1px solid #ffeaa7',
              fontSize: '14px'
            }}
          >
            ⚠️ {robot.error}
          </div>
        )}

        {/* Configurações TTS */}
        {showSettings && (
          <div
            style={{
              background: '#f8f9fa',
              padding: '20px',
              borderBottom: '1px solid #e9ecef'
            }}
          >
            <h4 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>🎛️ Configurações do Robô</h4>

            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
              <input
                type="checkbox"
                checked={ttsEnabled}
                onChange={e => setTtsEnabled(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontSize: '14px' }}>🤖 Ativar fala do robô</span>
            </label>

            {ttsEnabled && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '5px' }}>
                    Velocidade: {voiceConfig.rate}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={voiceConfig.rate}
                    onChange={e =>
                      setVoiceConfig(prev => ({ ...prev, rate: parseFloat(e.target.value) }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '5px' }}>
                    Tom: {voiceConfig.pitch}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={voiceConfig.pitch}
                    onChange={e =>
                      setVoiceConfig(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '5px' }}>
                    Volume: {voiceConfig.volume}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={voiceConfig.volume}
                    onChange={e =>
                      setVoiceConfig(prev => ({ ...prev, volume: parseFloat(e.target.value) }))
                    }
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={testRobot}
                    disabled={!robot.isConnected}
                    style={{
                      background: robot.isConnected ? '#28a745' : '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: robot.isConnected ? 'pointer' : 'not-allowed',
                      opacity: robot.isConnected ? 1 : 0.6
                    }}
                  >
                    🎤 Testar
                  </button>

                  <button
                    onClick={robot.stop}
                    disabled={!robot.isSpeaking}
                    style={{
                      background: robot.isSpeaking ? '#dc3545' : '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: robot.isSpeaking ? 'pointer' : 'not-allowed',
                      opacity: robot.isSpeaking ? 1 : 0.6
                    }}
                  >
                    ⏹️ Parar
                  </button>

                  <button
                    onClick={() => robot.repeat(voiceConfig)}
                    disabled={!robot.lastMessage || !robot.isConnected}
                    style={{
                      background: robot.lastMessage && robot.isConnected ? '#17a2b8' : '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: robot.lastMessage && robot.isConnected ? 'pointer' : 'not-allowed',
                      opacity: robot.lastMessage && robot.isConnected ? 1 : 0.6
                    }}
                  >
                    🔄 Repetir
                  </button>

                  <button
                    onClick={robot.checkConnection}
                    style={{
                      background: '#ffc107',
                      color: '#212529',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    🔍 Testar Conexão
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Área de mensagens */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px'
          }}
        >
          {messages.map(message => (
            <div
              key={message.id}
              style={{
                alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}
            >
              <div
                style={{
                  background:
                    message.sender === 'user'
                      ? 'linear-gradient(135deg, #2196F3, #1976D2)'
                      : message.type === 'error'
                      ? 'linear-gradient(135deg, #f44336, #d32f2f)'
                      : '#f8f9fa',
                  color:
                    message.sender === 'user'
                      ? 'white'
                      : message.type === 'error'
                      ? 'white'
                      : '#212529',
                  padding: '12px 16px',
                  borderRadius:
                    message.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  fontSize: '14px',
                  lineHeight: '1.4'
                }}
              >
                {message.text}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px',
                    fontSize: '11px',
                    opacity: 0.7
                  }}
                >
                  <span>{formatTimestamp(message.timestamp)}</span>

                  {message.sender === 'ai' && ttsEnabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {getTTSIcon(message.ttsStatus)}
                      {message.ttsStatus === 'sent' && <span>Falado</span>}
                      {message.ttsStatus === 'failed' && <span>Falha TTS</span>}
                      {message.ttsStatus === 'pending' && <span>Enviando...</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Indicador de digitação */}
          {isTyping && (
            <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
              <div
                style={{
                  background: '#f8f9fa',
                  padding: '12px 16px',
                  borderRadius: '18px 18px 18px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  color: '#666'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: '3px'
                  }}
                >
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#666',
                        animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite alternate`
                      }}
                    />
                  ))}
                </div>
                <span>{robot.isSpeaking ? 'IA pensando e robô falando...' : 'IA pensando...'}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Área de input */}
        <div
          style={{
            padding: '20px',
            borderTop: '1px solid #e9ecef',
            background: '#fff'
          }}
        >
          {/* Controles rápidos */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
              flexWrap: 'wrap'
            }}
          >
            <button
              onClick={clearChat}
              style={{
                background: '#6c757d',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '15px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              🗑️ Limpar
            </button>

            {robot.isSpeaking && (
              <button
                onClick={robot.stop}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '15px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ⏹️ Parar Robô
              </button>
            )}

            <button
              onClick={robot.checkConnection}
              style={{
                background: robot.isConnected ? '#28a745' : '#ffc107',
                color: robot.isConnected ? 'white' : '#212529',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '15px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {robot.isConnected ? '✅ Online' : '🔄 Reconectar'}
            </button>
          </div>

          {/* Input de mensagem */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={currentMessage}
              onChange={e => setCurrentMessage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Digite sua pergunta sobre robótica, programação..."
              disabled={isTyping}
              style={{
                flex: 1,
                padding: '12px 16px',
                border: '2px solid #e9ecef',
                borderRadius: '20px',
                fontSize: '14px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                minHeight: '44px',
                maxHeight: '120px'
              }}
              onFocus={e => {
                e.target.style.borderColor = '#2196F3';
              }}
              onBlur={e => {
                e.target.style.borderColor = '#e9ecef';
              }}
            />

            <button
              onClick={handleSendMessage}
              disabled={isTyping || !currentMessage.trim()}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background:
                  !isTyping && currentMessage.trim()
                    ? 'linear-gradient(135deg, #2196F3, #1976D2)'
                    : '#e9ecef',
                color: !isTyping && currentMessage.trim() ? 'white' : '#6c757d',
                border: 'none',
                fontSize: '16px',
                cursor: !isTyping && currentMessage.trim() ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              {isTyping ? '⏳' : '▶️'}
            </button>
          </div>

          {/* Status footer */}
          <div
            style={{
              textAlign: 'center',
              marginTop: '10px',
              fontSize: '11px',
              color: '#6c757d'
            }}
          >
            {ttsEnabled
              ? robot.isConnected
                ? '🤖 Respostas serão faladas pelo robô'
                : '⚠️ Robô desconectado - apenas texto'
              : '🔇 Fala do robô desabilitada'}
          </div>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          100% { opacity: 1; }
        }
        
        /* Scrollbar customizada */
        div::-webkit-scrollbar {
          width: 6px;
        }
        
        div::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        div::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
        
        div::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }

        /* Mobile responsivo */
        @media (max-width: 768px) {
          .chat-container {
            width: 100vw !important;
            right: ${isOpen ? '0' : '-100vw'} !important;
          }
        }
      `}</style>
    </>
  );
};

// ==================== EXEMPLO DE USO ====================
const App = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Sistema Edu-Ardu</h1>
      <p>Sua aplicação principal aqui...</p>

      {/* Chat com TTS integrado */}
      <ChatAIWithRobotTTS />
    </div>
  );
};

// ==================== FUNÇÕES DE TESTE GLOBAIS ====================
window.testRobotTTS = async text => {
  const tts = new RobotTTSService();
  const connected = await tts.checkConnection();

  if (connected) {
    console.log('🧪 Testando TTS com:', text);
    const success = await tts.speak(text || 'Teste do sistema TTS do robô Edu-Ardu');
    console.log(success ? '✅ Teste bem-sucedido' : '❌ Teste falhou');
  } else {
    console.log('❌ Robô não está conectado');
  }
};

window.checkRobotStatus = async () => {
  const tts = new RobotTTSService();
  const connected = await tts.checkConnection();
  console.log('🤖 Status do robô:', connected ? 'Conectado ✅' : 'Desconectado ❌');
  return connected;
};

// Log de inicialização
console.log(`
🚀 CHAT IA + TTS ROBÔ CARREGADO
===============================

Funções de teste disponíveis no console:
- testRobotTTS('seu texto aqui')
- checkRobotStatus()

Integração completa:
✅ Chat IA funcional
✅ TTS automático para robô
✅ Controles de configuração
✅ Retry e reconexão automática
✅ Interface responsiva

🎯 Sistema pronto para uso!
`);

export default ChatAIWithRobotTTS;
