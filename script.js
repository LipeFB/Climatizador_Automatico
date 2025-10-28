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
const toggleData = document.getElementById("pauseButton");
const darkModeButton = document.getElementById("darkModeButton");
const tempValue = document.getElementById("tempValue");
const humValue = document.getElementById("humValue");

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
// MQTT (conexão WebSocket)
// =======================
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");

// Tópicos de leitura
const jsonTopic = "senai/iot/dht11";
const topoTemp = "climatizador/temperatura";
const topoHum = "climatizador/umidade";
const topoDados = "climatizador/dados";

client.on("connect", () => {
  console.log("✅ Conectado ao MQTT");
  client.subscribe([jsonTopic, topoTemp, topoHum, topoDados], (err) => {
    if (err) console.warn("Erro subscribe:", err);
    else console.log("Inscrito em tópicos:", [jsonTopic, topoTemp, topoHum, topoDados]);
  });
});

// =======================
// Atualizar Status (apenas visual)
// =======================
function atualizarStatus(elemento, ativo) {
  if (modoEscuro) {
    elemento.className = "text-light";
  } else {
    elemento.className = ativo ? "text-success" : "text-secondary";
  }
}

// =======================
// Adiciona ponto aos gráficos (com limite)
// =======================
function pushData(tempo, temperatura, umidade) {
  if (typeof temperatura === "number") tempData.push(temperatura);
  else tempData.push(null);

  if (typeof umidade === "number") humData.push(umidade);
  else humData.push(null);

  labels.push(tempo);

  while (labels.length > MAX_POINTS) {
    labels.shift();
    tempData.shift();
    humData.shift();
  }

  chartTemp.update();
  chartHum.update();
}

// =======================
// Recebimento de Dados MQTT (aplica apenas modo automático)
// =======================
client.on("message", (topic, message) => {
  if (pause) return;
  const msgStr = message.toString();

  // 1) Mensagem JSON completa no tópico jsonTopic ou topoDados
  if (topic === jsonTopic || topic === topoDados) {
    try {
      const data = JSON.parse(msgStr);
      const now = new Date().toLocaleTimeString("pt-BR", { hour12: false });

      const t = typeof data.temperatura === "number" ? data.temperatura : (data.temp ?? undefined);
      const h = typeof data.umidade === "number" ? data.umidade : (data.hum ?? undefined);

      if (typeof t === "number") tempValue.textContent = `${t.toFixed(1)} °C`;
      if (typeof h === "number") humValue.textContent = `${h.toFixed(1)} %`;

      pushData(now, typeof t === "number" ? t : null, typeof h === "number" ? h : null);

      // Regras automáticas (sem manual)
      if (typeof t === "number") {
        const arQuenteOn = t < 11;   // ajuste de threshold (você pode alterar)
        const arFrioOn = t > 23;     // ajuste de threshold (você pode alterar)
        arQuenteStatus.textContent = arQuenteOn ? "Ligado" : "Desligado";
        atualizarStatus(arQuenteStatus, arQuenteOn);

        arFrioStatus.textContent = arFrioOn ? "Ligado" : "Desligado";
        atualizarStatus(arFrioStatus, arFrioOn);
      }

      if (typeof h === "number") {
        const umidOn = h < 40; // ajuste de threshold
        umidificadorStatus.textContent = umidOn ? "Ligado" : "Desligado";
        atualizarStatus(umidificadorStatus, umidOn);
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
      pushData(now, valor, null);

      const arQuenteOn = valor < 11;
      const arFrioOn = valor > 23;
      arQuenteStatus.textContent = arQuenteOn ? "Ligado" : "Desligado";
      atualizarStatus(arQuenteStatus, arQuenteOn);
      arFrioStatus.textContent = arFrioOn ? "Ligado" : "Desligado";
      atualizarStatus(arFrioStatus, arFrioOn);
    }
    return;
  }

  if (topic === topoHum) {
    const valor = parseFloat(msgStr);
    if (!Number.isNaN(valor)) {
      const now = new Date().toLocaleTimeString("pt-BR", { hour12: false });
      humValue.textContent = `${valor.toFixed(1)} %`;
      pushData(now, null, valor);

      const umidOn = valor < 40;
      umidificadorStatus.textContent = umidOn ? "Ligado" : "Desligado";
      atualizarStatus(umidificadorStatus, umidOn);
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
    // Mensagem não utilizada — pode ser log do Arduino
  }
});

// =======================
// Pausar / Retomar
// =======================
toggleData.addEventListener("click", () => {
  pause = !pause;
  toggleData.textContent = pause ? "▶️ Retomar Gráficos" : "⏸️ Pausar Gráficos";
});

// =======================
// Modo Escuro
// =======================
function aplicarModoEscuro(ativar) {
  modoEscuro = ativar;
  document.body.classList.toggle("dark", ativar);
  darkModeButton.textContent = ativar ? "☀️" : "🌙";
  localStorage.setItem("modoEscuro", modoEscuro);
}

darkModeButton.addEventListener("click", () => aplicarModoEscuro(!modoEscuro));

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
