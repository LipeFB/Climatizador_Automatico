#include <DHT.h>

#define DHTPIN 2
#define DHTTYPE DHT11

#define MOTOR_AR_QUENTE 8
#define MOTOR_AR_FRIO 9
#define MOTOR_UMIDIFICADOR 10

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();

  pinMode(MOTOR_AR_QUENTE, OUTPUT);
  pinMode(MOTOR_AR_FRIO, OUTPUT);
  pinMode(MOTOR_UMIDIFICADOR, OUTPUT);

  digitalWrite(MOTOR_AR_QUENTE, LOW);
  digitalWrite(MOTOR_AR_FRIO, LOW);
  digitalWrite(MOTOR_UMIDIFICADOR, LOW);
}

void loop() {
  float temperatura = dht.readTemperature();
  float umidade = dht.readHumidity();

  if (isnan(temperatura) || isnan(umidade)) {
    Serial.println("{\"error\":\"Erro ao ler o sensor DHT11\"}");
    delay(2000);
    return;
  }

  // === Envia dados em JSON para o Node.js ===
  Serial.print("{\"temperatura\":");
  Serial.print(temperatura);
  Serial.print(",\"umidade\":");
  Serial.print(umidade);
  Serial.println("}");

  // === Controle automático dos motores ===
  if (temperatura < 11) {
    digitalWrite(MOTOR_AR_QUENTE, HIGH);
    digitalWrite(MOTOR_AR_FRIO, LOW);
  } else if (temperatura > 23) {
    digitalWrite(MOTOR_AR_FRIO, HIGH);
    digitalWrite(MOTOR_AR_QUENTE, LOW);
  } else {
    digitalWrite(MOTOR_AR_FRIO, LOW);
    digitalWrite(MOTOR_AR_QUENTE, LOW);
  }

  if (umidade < 40) {
    digitalWrite(MOTOR_UMIDIFICADOR, HIGH);
  } else {
    digitalWrite(MOTOR_UMIDIFICADOR, LOW);
  }

  // Espera 2 segundos antes da próxima leitura
  delay(2000);
}
