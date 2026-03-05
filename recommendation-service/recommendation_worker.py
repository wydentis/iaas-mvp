import json
import asyncio
import logging
import aio_pika
import os
from google import genai

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Config ---
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY environment variable is not set")
    raise ValueError("GEMINI_API_KEY is required")
RABBITMQ_URL = os.environ.get('RABBITMQ_URL', "amqp://guest:guest@localhost/")
QUEUE_NAME = os.environ.get("QUEUE_NAME", "hardware_requests")

class HardwareWorker:
    def __init__(self):
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.model_id = os.environ.get("AI_MODEL_NAME", "gemini-2.0-flash")
        self.connection = None
        self.channel = None
        self.exchange = None

    async def process_message(self, message: aio_pika.IncomingMessage):
        """
        Processes the incoming RabbitMQ message and sends the AI response back.
        """
        async with message.process():
            try:
                body = json.loads(message.body.decode())
                user_text = body.get("text", "")
                
                logger.info(f"Processing request: {user_text[:50]}...")

                prompt = f"""Роль: Ты — эксперт по системной архитектуре. Твоя задача — рассчитать аппаратные требования сервера на основе запроса пользователя.
                    Принципы формирования конфигураций:
                    basic_minimum: "Ничего лишнего". Минимум ресурсов, при котором ОС и приложение запустятся и будут выполнять базовые функции без падений. Округление CPU до 1 ядра (если применимо), RAM — по нижней границе работоспособности.
                    optimal: "Золотая середина". Ресурсы подобраны с учетом нормальной нагрузки, кэширования и отсутствия задержек (latency). Ожидаемый аптайм и комфорт.
                    luxury_maximum: "High Availability & Performance". Конфигурация для пиковых нагрузок. Использование NVMe логики, избыточность RAM для работы In-memory DB, запас по ядрам для параллелизации.
                    Правила консистентности:
                    Если пользователь указал параметры явно — они становятся базисом для optimal.
                    Используй стандартные значения для индустрии (степени двойки для RAM: 1, 2, 4, 8, 16, 32...; четные числа для CPU, если > 1).
                    Всегда выдавай идентичные цифры для идентичных задач, основываясь на общепринятых бенчмарках (например, PostgreSQL требует минимум 2GB RAM для стабильной работы, Telegram-бот на Python — 512MB-1GB).
                    Обоснование должно быть не более 20 слов.
                    Формат ответа: Строгий JSON.
                    {{
                    "basic_minimum": {{ "cpu_cores": int, "ram_gb": int, "disk_size_gb": int, "reasoning": "string" }},
                    "optimal": {{ "cpu_cores": int, "ram_gb": int, "disk_size_gb": int, "reasoning": "string" }},
                    "luxury_maximum": {{ "cpu_cores": int, "ram_gb": int, "disk_size_gb": int, "reasoning": "string" }}
                    }}
                    Пользовательский запрос: {user_text}""";

                # Gemini Call
                response = await self.client.aio.models.generate_content(
                    model=self.model_id,
                    contents=prompt
                )
                
                # Clean JSON string from potential Markdown formatting
                raw_text = response.text.strip().removeprefix('```json').removesuffix('```').strip()
                structured_data = json.loads(raw_text)

                if message.reply_to:
                    await self.exchange.publish(
                        aio_pika.Message(
                            body=json.dumps(structured_data, ensure_ascii=False).encode(),
                            correlation_id=message.correlation_id,
                        ),
                        routing_key=message.reply_to,
                    )
                    logger.info(f"Success: Replied to {message.correlation_id}")

            except Exception as e:
                logger.error(f"Worker Error: {e}", exc_info=True)
                if message.reply_to:
                    error_payload = json.dumps({
                        "error": "AI processing failed",
                        "status": "error"
                    }).encode()
                    await self.exchange.publish(
                        aio_pika.Message(
                            body=error_payload,
                            correlation_id=message.correlation_id,
                        ),
                        routing_key=message.reply_to,
                    )

    async def start(self):
        """
        Main loop handling connection and consumption.
        """
        while True:
            try:
                logger.info("Connecting to RabbitMQ...")
                self.connection = await aio_pika.connect_robust(RABBITMQ_URL)
                
                async with self.connection:
                    self.channel = await self.connection.channel()
                    await self.channel.set_qos(prefetch_count=1)
                    
                    # Store the default exchange for replies
                    self.exchange = self.channel.default_exchange
                    
                    queue = await self.channel.declare_queue(QUEUE_NAME, durable=True)
                    logger.info(f"[*] Worker fully initialized. Listening on '{QUEUE_NAME}'")
                    
                    # Consume until the connection is closed
                    async with queue.iterator() as queue_iter:
                        async for message in queue_iter:
                            await self.process_message(message)
                
            except (aio_pika.exceptions.AMQPError, asyncio.CancelledError) as e:
                if isinstance(e, asyncio.CancelledError):
                    break
                logger.warning(f"Connection lost. Retrying in 5s... Error: {e}")
                await asyncio.sleep(5)

async def main():
    worker = HardwareWorker()
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Worker stopped by user.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass