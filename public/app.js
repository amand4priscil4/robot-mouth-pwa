// Configurações globais
const CONFIG = {
  // Substitua pela URL do seu backend quando estiver pronto
  SSE_ENDPOINT: 'http://localhost:3000/api/speech/stream',
  TABLET_ID: 'tablet_' + Math.random().toString(36).substr(2, 9)
};

// Estado da aplicação
let isSpeaking = false;
let speechSynthesis = window.speechSynthesis;
let currentVoice = null;
let eventSource = null;

// Elementos do DOM
const mouth = document.getElementById('mouth');
const soundWaves = document.getElementById('soundWaves');
const statusText = document.getElementById('statusText');
const connectionStatus = document.getElementById('connectionStatus');

// ========== INICIALIZAÇÃO ==========

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registrado:', registration);
        updateStatus('PWA instalado com sucesso');
      })
      .catch(error => {
        console.error('❌ Erro no Service Worker:', error);
      });
  });
}

// ========== SÍNTESE DE VOZ ==========

// Configurar síntese de voz
function initSpeech() {
  const voices = speechSynthesis.getVoices();

  // Tentar encontrar voz em português brasileiro
  currentVoice =
    voices.find(
      voice =>
        voice.lang.includes('pt-BR') ||
        voice.lang.includes('pt') ||
        voice.name.toLowerCase().includes('portuguese')
    ) || voices[0];

  console.log('🎤 Voz selecionada:', currentVoice?.name, currentVoice?.lang);
  updateStatus('Sistema de voz carregado');
  setConnectionStatus(true);
}

// Falar texto
function speak(text, options = {}) {
  if (isSpeaking) {
    speechSynthesis.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);

  // Configurações de voz
  utterance.voice = currentVoice;
  utterance.rate = options.rate || 0.9;
  utterance.pitch = options.pitch || 1;
  utterance.volume = options.volume || 1;

  // Eventos da síntese
  utterance.onstart = () => {
    isSpeaking = true;
    startSpeaking();
    updateStatus(`Falando: "${text.substring(0, 30)}..."`);
  };

  utterance.onend = () => {
    isSpeaking = false;
    stopSpeaking();
    updateStatus('Pronto para falar');
  };

  utterance.onerror = error => {
    console.error('❌ Erro na síntese:', error);
    isSpeaking = false;
    stopSpeaking();
    updateStatus('Erro na síntese de voz');
  };

  speechSynthesis.speak(utterance);
}

// ========== ANIMAÇÕES ==========

// Iniciar animação de fala
function startSpeaking() {
  mouth.classList.add('speaking');
  soundWaves.classList.add('active');
}

// Parar animação de fala
function stopSpeaking() {
  mouth.classList.remove('speaking');
  soundWaves.classList.remove('active');
}

// Estados de humor
function setMoodHappy() {
  mouth.className = 'mouth happy';
  updateStatus('Estado: Feliz 😊');
}

function setMoodSurprised() {
  mouth.className = 'mouth surprised';
  updateStatus('Estado: Surpreso 😮');
}

function setMoodNormal() {
  mouth.className = 'mouth normal';
  updateStatus('Estado: Normal 😐');
}

// ========== INTERFACE ==========

// Atualizar status da conexão
function setConnectionStatus(connected) {
  if (connected) {
    connectionStatus.className = 'connection-status connected';
    connectionStatus.innerHTML = '<div class="indicator"></div><span>Conectado</span>';
  } else {
    connectionStatus.className = 'connection-status disconnected';
    connectionStatus.innerHTML = '<div class="indicator"></div><span>Desconectado</span>';
  }
}

// Atualizar texto de status
function updateStatus(text) {
  statusText.textContent = text;
  console.log('📊 Status:', text);
}

// ========== SERVER-SENT EVENTS ==========

// Conectar ao SSE
function connectToSSE() {
  try {
    // Tentar conectar ao endpoint real
    eventSource = new EventSource(`${CONFIG.SSE_ENDPOINT}?tabletId=${CONFIG.TABLET_ID}`);

    eventSource.onopen = function () {
      console.log('🔗 Conectado ao SSE');
      setConnectionStatus(true);
      updateStatus('Conectado ao servidor');
    };

    eventSource.onmessage = function (event) {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Mensagem recebida:', data);

        // Processar diferentes tipos de mensagem
        switch (data.type) {
          case 'speech':
            speak(data.text, data.options);
            break;
          case 'mood':
            setMood(data.mood);
            break;
          case 'status':
            updateStatus(data.message);
            break;
          default:
            console.log('📋 Tipo de mensagem desconhecido:', data.type);
        }
      } catch (error) {
        console.error('❌ Erro ao processar mensagem SSE:', error);
      }
    };

    eventSource.onerror = function (error) {
      console.error('❌ Erro SSE:', error);
      setConnectionStatus(false);
      updateStatus('Erro de conexão - modo offline');

      // Tentar reconectar após 5 segundos
      setTimeout(connectToSSE, 5000);
    };
  } catch (error) {
    console.error('❌ Erro ao iniciar SSE:', error);
    simulateOfflineMode();
  }
}

// Modo offline/demonstração
function simulateOfflineMode() {
  console.log('🔄 Iniciando modo demonstração');
  setTimeout(() => {
    setConnectionStatus(false);
    updateStatus('Modo demonstração - Use os botões de teste');
  }, 1000);
}

// Definir humor por comando
function setMood(mood) {
  switch (mood) {
    case 'happy':
      setMoodHappy();
      break;
    case 'surprised':
      setMoodSurprised();
      break;
    case 'normal':
      setMoodNormal();
      break;
    default:
      console.log('❓ Humor desconhecido:', mood);
  }
}

// ========== FUNÇÕES DE TESTE ==========

function testSpeech(text) {
  speak(text || 'Olá! Este é um teste do sistema de síntese de voz do robô.');
}

// ========== INICIALIZAÇÃO PRINCIPAL ==========

window.addEventListener('load', () => {
  console.log('🚀 Iniciando Boca do Robô PWA');

  // Aguardar vozes carregarem
  if (speechSynthesis.getVoices().length === 0) {
    speechSynthesis.addEventListener('voiceschanged', initSpeech);
  } else {
    initSpeech();
  }

  // Conectar ao SSE
  connectToSSE();

  // Definir estado padrão como feliz
  updateStatus('Estado: Feliz 😊 (padrão)');

  console.log('✅ Tablet ID:', CONFIG.TABLET_ID);
});

// ========== CLEANUP ==========

// Cleanup ao sair
window.addEventListener('beforeunload', () => {
  if (isSpeaking) {
    speechSynthesis.cancel();
  }
  if (eventSource) {
    eventSource.close();
  }
});

// Detectar se está rodando como PWA instalado
window.addEventListener('DOMContentLoaded', () => {
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    console.log('📱 Rodando como PWA instalado');
    updateStatus('PWA instalado - Modo robô ativo');
  }
});
