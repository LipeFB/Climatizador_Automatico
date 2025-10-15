// ======== Variáveis ========
let pause = false;
let modoEscuro = false;

// ======== Elementos ========
const arQuenteStatus = document.getElementById("arQuente");
const arFrioStatus = document.getElementById("arFrio");
const umidificadorStatus = document.getElementById("umidificador");
const toggleData = document.getElementById("toggleData");
const toggleMode = document.getElementById("toggleMode");
const titulo = document.getElementById("titulo");

// ======== Gráficos ========
const labels = [];
const tempData = [];
const humData = [];

const ctxTemp = document.getElementById("graficoTemp").getContext("2d");
const ctxHum = document.getElementById("graficoHum").getContext("2d");

const chartTemp = new Chart(ctxTemp, {
  type: "line",
  data: { labels, datasets: [{ label: "Temperatura (°C)", data: tempData, borderColor: "red", backgroundColor: "rgba(255,0,0,0.2)", tension: 0.3, fill: true }]},
  options: { responsive: false, scales: { y: { beginAtZero: true, max: 50 }, x: {} } }
});

const chartHum = new Chart(ctxHum, {
  type: "bar",
  data: { labels, datasets: [{ label: "Umidade (%)", data: humData, borderColor: "blue", backgroundColor: "rgba(0,0,255,0.2)", tension: 0.3, fill: true }]},
  options: { responsive: false, scales: { y: { beginAtZero: true, max: 100 }, x: {} } }
});

// ======== Conexão MQTT ========
const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
const topic = "senai/iot/dht11";

client.on("connect", () => {
  console.log("Conectado ao MQTT");
  client.subscribe(topic);
});

// ======== Função para atualizar status ========
function atualizarStatus(elemento, ativo) {
  if (modoEscuro) {
    elemento.className = "text-light"; // Sempre branco no Dark Mode
  } else {
    elemento.className = ativo ? "text-success" : "text-secondary"; // Verde ou cinza no Light Mode
  }
}

// ======== Recebimento de dados ========
client.on("message", (topic, message) => {
  if (pause) return;

  try {
    const data = JSON.parse(message.toString());
    const time = new Date().toLocaleTimeString();

    labels.push(time);
    tempData.push(data.temperatura);
    humData.push(data.umidade);

    if (labels.length > 20) { labels.shift(); tempData.shift(); humData.shift(); }

    chartTemp.update();
    chartHum.update();

    // Atualiza textos dos status
    arQuenteStatus.textContent = data.temperatura < 11 ? "Ligado" : "Desligado";
    arFrioStatus.textContent = data.temperatura > 23 ? "Ligado" : "Desligado";
    umidificadorStatus.textContent = data.umidade < 40 ? "Ligado" : "Desligado";

    // Atualiza cores dos status
    atualizarStatus(arQuenteStatus, data.temperatura < 11);
    atualizarStatus(arFrioStatus, data.temperatura > 23);
    atualizarStatus(umidificadorStatus, data.umidade < 40);

  } catch (err) {
    console.error("Erro ao parsear mensagem MQTT:", message.toString());
  }
});

// ======== Botão Pausar/Retomar ========
toggleData.addEventListener("click", () => {
  pause = !pause;
  toggleData.textContent = pause ? "▶️ Retomar Dados" : "⏸️ Pausar Dados";
});

// ======== Botão Dark Mode ========
toggleMode.addEventListener("click", () => {
  modoEscuro = !modoEscuro;

  const statusLabels = document.querySelectorAll(".status span");
  const h3Elements = document.querySelectorAll("h3");

  if (modoEscuro) {
    document.body.classList.add("bg-dark", "text-light");
    toggleMode.textContent = "☀️ Light Mode";

    // Título principal
    titulo.classList.add("text-light");

    // Títulos dos gráficos
    h3Elements.forEach(el => el.classList.add("text-light"));

    // Status ficam brancos
    statusLabels.forEach(el => el.classList.add("text-light"));

  } else {
    document.body.classList.remove("bg-dark", "text-light");
    toggleMode.textContent = "🌙 Dark Mode";

    // Título principal
    titulo.classList.remove("text-light");

    // Títulos dos gráficos
    h3Elements.forEach(el => el.classList.remove("text-light"));

    // Status voltam a cores normais (verde/cinza)
    atualizarStatus(arQuenteStatus, arQuenteStatus.textContent === "Ligado");
    atualizarStatus(arFrioStatus, arFrioStatus.textContent === "Ligado");
    atualizarStatus(umidificadorStatus, umidificadorStatus.textContent === "Ligado");
  }
});
