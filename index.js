const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const mqtt = require("mqtt");

// Porta serial e conexão MQTT
const port = new SerialPort({ path: "COM14", baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

const client = mqtt.connect("mqtt://broker.hivemq.com:1883");

// Tópicos
const topicoDados = "climatizador/dados";
const topicoControle = "climatizador/controle";

client.on("connect", () => {
  console.log("✅ Conectado ao broker MQTT");
  client.subscribe(topicoControle);
});

// Recebe dados do Arduino e envia para o MQTT (filtrando linhas que não sejam JSON)
parser.on("data", (data) => {
  data = data.trim();

  if (data.startsWith("{") && data.endsWith("}")) {
    try {
      const json = JSON.parse(data);
      client.publish(topicoDados, JSON.stringify(json));
      console.log("📡 Dados enviados:", json);
    } catch (err) {
      console.error("❌ JSON inválido:", err.message);
    }
  } else {
    // apenas log para mensagens de debug do Arduino
    console.log("💬 Arduino:", data);
  }
});

// Recebe comandos do dashboard e envia para o Arduino
client.on("message", (topic, message) => {
  if (topic === topicoControle) {
    const comando = JSON.parse(message.toString());
    console.log("📥 Comando recebido do painel:", comando);
    port.write(JSON.stringify(comando) + "\n");
  }
});
