#include <DHT.h>
#define DHTPIN 2
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

#define MOTOR_AR_QUENTE 8
#define MOTOR_AR_FRIO 9
#define MOTOR_UMIDIFICADOR 10

bool estadoArQuente = false;
bool estadoArFrio = false;
bool estadoUmidificador = false;

void setup() {
  Serial.begin(9600);
  dht.begin();

  pinMode(MOTOR_AR_QUENTE, OUTPUT);
  pinMode(MOTOR_AR_FRIO, OUTPUT);
  pinMode(MOTOR_UMIDIFICADOR, OUTPUT);
}

void loop() {
  float temperatura = dht.readTemperature();
  float umidade = dht.readHumidity();

  if (!isnan(temperatura) && !isnan(umidade)) {
    Serial.print("{\"temperatura\":");
    Serial.print(temperatura);
    Serial.print(",\"umidade\":");
    Serial.print(umidade);
    Serial.print(",\"arQuente\":");
    Serial.print(estadoArQuente ? "true" : "false");
    Serial.print(",\"arFrio\":");
    Serial.print(estadoArFrio ? "true" : "false");
    Serial.print(",\"umidificador\":");
    Serial.print(estadoUmidificador ? "true" : "false");
    Serial.println("}");
  }

  // Recebe comandos
  if (Serial.available()) {
    String comando = Serial.readStringUntil('\n');
    if (comando.indexOf("arQuente") > 0) {
      estadoArQuente = !estadoArQuente;
      digitalWrite(MOTOR_AR_QUENTE, estadoArQuente);
    }
    if (comando.indexOf("arFrio") > 0) {
      estadoArFrio = !estadoArFrio;
      digitalWrite(MOTOR_AR_FRIO, estadoArFrio);
    }
    if (comando.indexOf("umidificador") > 0) {
      estadoUmidificador = !estadoUmidificador;
      digitalWrite(MOTOR_UMIDIFICADOR, estadoUmidificador);
    }
  }

  delay(2000);
}
