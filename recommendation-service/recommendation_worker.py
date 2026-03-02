import json
import asyncio
import logging
import aio_pika
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from google import genai

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Config
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
RABBITMQ_URL = os.environ.get('RABBITMQ_URL', "amqp://guest:guest@localhost/")
QUEUE_NAME = os.environ.get("QUEUE_NAME")

class HardwareWorker:
    def __init__(self):
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.model_id = os.environ.get("AI_MODEL_NAME", "gemini-2.5-flash")
        self.connection = None
        self.channel = None
        self.exchange = None  # We will store the initialized exchange here

    async def process_message(self, message: aio_pika.IncomingMessage):
        """
        By using self.exchange (initialized at startup), 
        we bypass any issues with the message's internal channel state.
        """
        async with message.process():
            try:
                body = json.loads(message.body.decode())
                user_text = body.get("text", "")
                
                prompt = f"""Роль: Ты — эксперт по системной архитектуре. Твоя задача — рассчитать аппаратные требования сервера на основе запроса пользователя.
                    Принципы формирования конфигураций:
                    basic_minimum: "Ничего лишнего". Минимум ресурсов, при котором ОС и приложение запустятся и будут выполнять базовые функции без падений. Округление CPU до 1 ядра (если применимо), RAM — по нижней границе работоспособности.
                    optimal: "Золотая середина". Ресурсы подобраны с учетом нормальной нагрузки, кэширования и отсутствия задержек (latency). Ожидаемый аптайм и комфорт.
                    luxury_maximum: "High Availability & Performance". Конфигурация для пиковых нагрузок. Использование NVMe логики, избыточность RAM для работы In-memory DB, запас по ядрам для параллелизации.
                    Правила консистентности:
                    Если пользователь указал параметры явно — они становятся базисом для optimal.
                    Используй стандартные значения для индустрии (степени двойки для RAM: 1, 2, 4, 8, 16, 32...; четные числа для CPU, если > 1).
                    Всегда выдавай идентичные цифры для идентичных задач, основываясь на общепринятых бенчмарках (например, PostgreSQL требует минимум 2GB RAM для стабильной работы, Telegram-бот на Python — 512MB-1GB).
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
                response = response.text.strip().replace('```json', '').replace('```', '')

                if message.reply_to:
                    # We use the exchange we initialized in the 'start' method
                    await self.exchange.publish(
                        aio_pika.Message(
                            body=json.dumps(response, ensure_ascii=False).encode(),
                            correlation_id=message.correlation_id,
                        ),
                        routing_key=message.reply_to,
                    )
                    logger.info(f"Success: Replied to {message.correlation_id}")

            except Exception as e:
                logger.error(f"Worker Error: {e}")

    async def start(self):
        """
        Initializes the connection, channel, and exchange 
        BEFORE starting the consumer.
        """
        while True:
            try:
                self.connection = await aio_pika.connect_robust(RABBITMQ_URL)
                
                # 1. Create and store the channel
                self.channel = await self.connection.channel()
                await self.channel.set_qos(prefetch_count=1)
                
                # 2. Initialize the default exchange (empty string name)
                # This ensures the 'exchange' object is 100% ready
                self.exchange = self.channel.default_exchange
                
                # 3. Declare queue and start consuming
                queue = await self.channel.declare_queue(QUEUE_NAME, durable=True)
                logger.info(f"[*] Worker fully initialized. Listening on {QUEUE_NAME}")
                
                await queue.consume(self.process_message)
                
                # Wait forever (or until task is cancelled)
                await asyncio.Future()
                
            except (aio_pika.exceptions.AMQPError, asyncio.CancelledError) as e:
                if isinstance(e, asyncio.CancelledError): break
                logger.warning(f"Connection failed. Retrying... {e}")
                await asyncio.sleep(5)

# --- FastAPI Integration ---

worker = HardwareWorker()

@asynccontextmanager
async def lifespan(app: FastAPI):
    worker_task = asyncio.create_task(worker.start())
    yield
    worker_task.cancel()

app = FastAPI(lifespan=lifespan)

@app.get("/health")
async def health(): return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)