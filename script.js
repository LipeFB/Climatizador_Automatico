// =======================
// Variáveis Globais
// =======================
let pause = false;
let modoEscuro = false;

// =======================
// Elementos HTML
// =======================
const arQuenteStatus = document.getElementById("statusArQuente");
const arFrioStatus = document.getElementById("statusArFrio");
const umidificadorStatus = document.getElementById("statusUmidificador");

const btnArQuente = document.getElementById("btnArQuente");
const btnArFrio = document.getElementById("btnArFrio");
const btnUmidificador = document.getElementById("btnUmidificador");

const toggleData = document.getElementById("pauseButton");
const darkModeButton = document.getElementById("darkModeButton");

const tempValue = document.getElementById("tempValue");
const humValue = document.getElementById("humValue");
const titulo = document.getElementById("titulo");

// =======================
// Gráficos
// =======================
const MAX_POINTS = 20;
const labels = [];
const tempData = [];
const humData = [];

const ctxTemp = document.getElementById("tempChart").getContext("2d");
const ctxHum = document.getElementById("humChart").getContext("2d");

const chartTemp = new Chart(ctxTemp, {
  type: "line",
  data: {
    labels,
    datasets: [{
      label: "Temperatura (°C)",
      data: tempData,
      borderColor: "red",
      backgroundColor: "rgba(255,0,0,0.2)",
      tension: 0.3,
      fill: true
    }]
  },
  options: {
    responsive: false,
    scales: { y: { beginAtZero: true, max: 50 } }
  }
});

const chartHum = new Chart(ctxHum, {
  type: "bar",
  data: {
    labels,
    datasets: [{
      label: "Umidade (%)",
      data: humData,
      borderColor: "blue",
      backgroundColor: "rgba(0,0,255,0.2)",
      tension: 0.3,
      fill: true
    }]
  },
  options: {
    responsive: false,
    scales: { y: { beginAtZero: true, max: 100 } }
  }
});

// =======================
// MQTT
// =======================
// conecta por websocket (compatível com broker.hivemq)
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

// Assinamos múltiplos tópicos possíveis para cobrir seu fluxo Node.js/Serial/MQTT
const jsonTopic = "senai/iot/dht11";           // envia JSON {temperatura, umidade}
const topoTemp = "climatizador/temperatura";   // envia só temperatura numérica
const topoHum = "climatizador/umidade";        // envia só umidade numérica
const topoDados = "climatizador/dados";        // alternativa possível
const comandoTopic = "senai/iot/comando";      // tópico para enviar comandos

client.on("connect", () => {
  console.log("✅ Conectado ao MQTT");
  // Inscreve em todos os tópicos que podem ser usados pelo server.js ou por você
  client.subscribe([jsonTopic, topoTemp, topoHum, topoDados], (err) => {
    if (err) console.warn("Erro subscribe:", err);
    else console.log("Inscrito em tópicos:", [jsonTopic, topoTemp, topoHum, topoDados]);
  });
});

// =======================
// Função Atualizar Status
// =======================
function atualizarStatus(elemento, ativo) {
  if (modoEscuro) {
    elemento.className = "text-light";
  } else {
    elemento.className = ativo ? "text-success" : "text-secondary";
  }
}

// =======================
// Ajuda: adiciona ponto aos gráficos (com limite)
// =======================
function pushData(tempo, temperatura, umidade) {
  // se valores forem inválidos, não empurra
  if (typeof temperatura === "number") {
    tempData.push(temperatura);
  } else {
    tempData.push(null);
  }
  if (typeof umidade === "number") {
    humData.push(umidade);
  } else {
    humData.push(null);
  }
  labels.push(tempo);

  // limita
  while (labels.length > MAX_POINTS) {
    labels.shift();
    tempData.shift();
    humData.shift();
  }

  chartTemp.update();
  chartHum.update();
}

// =======================
// Recebimento de Dados MQTT (robusto)
// =======================
client.on("message", (topic, message) => {
  if (pause) return;

  const msgStr = message.toString();
  // debug opcional
  // console.log("MQTT ->", topic, msgStr);

  // 1) Mensagem JSON completa no tópico jsonTopic ou topoDados
  if (topic === jsonTopic || topic === topoDados) {
    try {
      const data = JSON.parse(msgStr);
      const now = new Date().toLocaleTimeString("pt-BR", { hour12: false });

      // aceita { temperatura, umidade } (números)
      const t = typeof data.temperatura === "number" ? data.temperatura : (data.temp ?? undefined);
      const h = typeof data.umidade === "number" ? data.umidade : (data.hum ?? undefined);

      // atualiza valores visuais
      if (typeof t === "number") tempValue.textContent = `${t.toFixed(1)} °C`;
      if (typeof h === "number") humValue.textContent = `${h.toFixed(1)} %`;

      pushData(now, typeof t === "number" ? t : null, typeof h === "number" ? h : null);

      // regras automáticas (se não estiver em manual)
      if (typeof t === "number") {
        if (!btnArQuente.classList.contains("manual")) {
          const arQuenteOn = t < 40;
          arQuenteStatus.textContent = arQuenteOn ? "Ligado" : "Desligado";
          atualizarStatus(arQuenteStatus, arQuenteOn);
        }
        if (!btnArFrio.classList.contains("manual")) {
          const arFrioOn = t > 50;
          arFrioStatus.textContent = arFrioOn ? "Ligado" : "Desligado";
          atualizarStatus(arFrioStatus, arFrioOn);
        }
      }
      if (typeof h === "number") {
        if (!btnUmidificador.classList.contains("manual")) {
          const umidOn = h < 40;
          umidificadorStatus.textContent = umidOn ? "Ligado" : "Desligado";
          atualizarStatus(umidificadorStatus, umidOn);
        }
      }
      return;
    } catch (e) {
      console.warn("JSON inválido no tópico", topic, e);
      // prossegue tentando outras interpretações
    }
  }

  // 2) Mensagem numérica em tópicos separados
  if (topic === topoTemp) {
    const valor = parseFloat(msgStr);
    if (!Number.isNaN(valor)) {
      const now = new Date().toLocaleTimeString("pt-BR", { hour12: false });
      tempValue.textContent = `${valor.toFixed(1)} °C`;
      pushData(now, valor, null); // adiciona temp e null para umidade
      // atualizar auto status
      if (!btnArQuente.classList.contains("manual")) {
        const arQuenteOn = valor < 11;
        arQuenteStatus.textContent = arQuenteOn ? "Ligado" : "Desligado";
        atualizarStatus(arQuenteStatus, arQuenteOn);
      }
      if (!btnArFrio.classList.contains("manual")) {
        const arFrioOn = valor > 23;
        arFrioStatus.textContent = arFrioOn ? "Ligado" : "Desligado";
        atualizarStatus(arFrioStatus, arFrioOn);
      }
    }
    return;
  }

  if (topic === topoHum) {
    const valor = parseFloat(msgStr);
    if (!Number.isNaN(valor)) {
      const now = new Date().toLocaleTimeString("pt-BR", { hour12: false });
      humValue.textContent = `${valor.toFixed(1)} %`;
      pushData(now, null, valor);
      if (!btnUmidificador.classList.contains("manual")) {
        const umidOn = valor < 40;
        umidificadorStatus.textContent = umidOn ? "Ligado" : "Desligado";
        atualizarStatus(umidificadorStatus, umidOn);
      }
    }
    return;
  }

  // 3) fallback: tenta interpretar qualquer mensagem como JSON com temperatura/umidade
  try {
    const data = JSON.parse(msgStr);
    const now = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    const t = typeof data.temperatura === "number" ? data.temperatura : undefined;
    const h = typeof data.umidade === "number" ? data.umidade : undefined;
    if (t !== undefined || h !== undefined) {
      if (t !== undefined) tempValue.textContent = `${t.toFixed(1)} °C`;
      if (h !== undefined) humValue.textContent = `${h.toFixed(1)} %`;
      pushData(now, t !== undefined ? t : null, h !== undefined ? h : null);
    }
  } catch (e) {
    // nada a fazer se não puder interpretar
    // console.log("Mensagem recebida (não utilizada)", topic, msgStr);
  }
});

// =======================
// Função Enviar Comando MQTT
// =======================
function enviarComando(componente, estado) {
  const comando = JSON.stringify({ componente, estado });
  client.publish(comandoTopic, comando);
  console.log("📤 Enviado comando:", comando);
}

// =======================
// Alternar Componente Manual
// =======================
function alternarComponente(botao, statusSpan, componente) {
  const ligado = botao.classList.contains("on");
  const novoEstado = ligado ? "desligar" : "ligar";

  // envia comando para o broker (Node.js pode repassar para Arduino via Serial)
  enviarComando(componente, novoEstado);

  // atualiza visual
  if (ligado) {
    botao.classList.remove("on");
    botao.classList.add("off");
    botao.classList.remove("manual");
    statusSpan.textContent = "Desligado";
    statusSpan.style.color = modoEscuro ? "white" : "gray";
  } else {
    botao.classList.add("on");
    botao.classList.remove("off");
    botao.classList.add("manual"); // marca que está em override manual
    statusSpan.textContent = "Ligado";
    statusSpan.style.color = "green";
  }
}

// =======================
// Eventos Botões
// =======================
btnArQuente.addEventListener("click", () =>
  alternarComponente(btnArQuente, arQuenteStatus, "arQuente")
);
btnArFrio.addEventListener("click", () =>
  alternarComponente(btnArFrio, arFrioStatus, "arFrio")
);
btnUmidificador.addEventListener("click", () =>
  alternarComponente(btnUmidificador, umidificadorStatus, "umidificador")
);

// =======================
// Botão Pausar/Retomar
// =======================
toggleData.addEventListener("click", () => {
  pause = !pause;
  toggleData.textContent = pause ? "▶️ Retomar Gráficos" : "⏸️ Pausar Gráficos";
});

// =======================
// Botão Modo Escuro
// =======================
function aplicarModoEscuro(ativar) {
  modoEscuro = ativar;
  document.body.classList.toggle("dark", ativar);

  // só emoji no botão
  darkModeButton.textContent = ativar ? "☀️" : "🌙";

  // Atualiza cores dos status que não estão on
  const statusLabels = document.querySelectorAll(".status span");
  statusLabels.forEach((el) => {
    if (!el.parentElement.querySelector("button")?.classList.contains("on")) {
      el.className = modoEscuro ? "text-light" : "text-secondary";
    }
  });

  localStorage.setItem("modoEscuro", modoEscuro);
}
darkModeButton.addEventListener("click", () => aplicarModoEscuro(!modoEscuro));

// inicializa modo salvo
const modoSalvo = localStorage.getItem("modoEscuro") === "true";
aplicarModoEscuro(modoSalvo);

// =======================
// Placeholders iniciais
// =======================
tempValue.textContent = "- °C";
humValue.textContent = "- %";
arQuenteStatus.textContent = "Desligado";
arFrioStatus.textContent = "Desligado";
umidificadorStatus.textContent = "Desligado";
