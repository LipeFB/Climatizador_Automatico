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

// Recebe dados do Arduino e envia para o MQTT
parser.on("data", (data) => {
  try {
    const json = JSON.parse(data);
    client.publish(topicoDados, JSON.stringify(json));
    console.log("📡 Dados enviados:", json);
  } catch (err) {
    console.error("Erro ao converter dados:", err.message);
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
