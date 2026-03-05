import os
import json
import logging
import asyncio
import aio_pika
import redis.asyncio as redis
from google import genai
from google.genai import types

# --- Настройка логирования ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

class ChatWorker:
    def __init__(self):
        # Конфигурация
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.rabbitmq_url = os.getenv('RABBITMQ_URL', 'amqp://guest:guest@localhost/')
        self.queue_name = os.getenv("CONSULTER_RESPONSE_QUEUE", "chat_requests")
        self.model_id = os.getenv('AI_MODEL_NAME', 'gemini-2.0-flash')
        
        # Клиенты
        self.client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
        self.redis = redis.from_url(self.redis_url, decode_responses=True)
        
        # Состояние RabbitMQ
        self.connection = None
        self.channel = None

    async def save_message(self, user_id: str, role: str, content: str):
        data = json.dumps({"role": role, "content": content})
        key = f"chat:{user_id}"
        await self.redis.rpush(key, data)
        await self.redis.ltrim(key, -20, -1)
        await self.redis.expire(key, 86400)

    async def get_formatted_history(self, user_id: str, limit: int = 5):
        raw_history = await self.redis.lrange(f"chat:{user_id}", -limit, -1)
        history_objects = []
        for item in raw_history:
            msg = json.loads(item)
            history_objects.append(
                types.Content(
                    role=msg["role"],
                    parts=[types.Part.from_text(text=msg["content"])]
                )
            )
        return history_objects

    async def process_message(self, message: aio_pika.IncomingMessage):
        """Основная логика обработки сообщения"""
        async with message.process():
            user_id = "unknown"
            try:
                body = json.loads(message.body.decode())
                user_id = body.get("user_id")
                command = body.get("command", "chat")

                if command == "clear_history":
                    log.info(f"Clearing history for user_id={user_id}")
                    key = f"chat:{user_id}"
                    await self.redis.delete(key)
                    
                    if message.reply_to:
                        await self.channel.default_exchange.publish(
                            aio_pika.Message(
                                body=json.dumps({
                                    "user_id": user_id,
                                    "status": "success",
                                    "message": "History cleared"
                                }).encode(),
                                correlation_id=message.correlation_id,
                            ),
                            routing_key=message.reply_to,
                        )
                    return

                user_text = body.get("message")

                if not user_id or not user_text:
                    log.warning("Missing user_id or message text")
                    return

                log.info(f"Processing message for user_id={user_id}")

                # 1. Получаем историю
                chat_history = await self.get_formatted_history(user_id, limit=5)

                # 2. Взаимодействие с Gemini (используем асинхронный метод SDK)
                try:
                    # В новом SDK Google GenAI используем .aio для асинхронности
                    chat = self.client.aio.chats.create(model=self.model_id, history=chat_history)
                    response = await asyncio.wait_for(
                        chat.send_message(user_text),
                        timeout=120.0
                    )
                    ai_text = response.text
                except asyncio.TimeoutError:
                    raise RuntimeError("AI Generation timed out")

                # 3. Сохраняем историю только при успехе
                await asyncio.gather(
                    self.save_message(user_id, "user", user_text),
                    self.save_message(user_id, "model", ai_text)
                )

                # 4. Ответ в RabbitMQ
                if message.reply_to:
                    await self.channel.default_exchange.publish(
                        aio_pika.Message(
                            body=json.dumps({
                                "user_id": user_id,
                                "response": ai_text,
                                "status": "success"
                            }).encode(),
                            correlation_id=message.correlation_id,
                        ),
                        routing_key=message.reply_to,
                    )

            except Exception as e:
                log.error(f"Error processing message: {e}", exc_info=True)
                if message.reply_to:
                    error_payload = json.dumps({
                        "user_id": user_id,
                        "status": "error",
                        "code": 500,
                        "message": "AI processing failed."
                    }).encode()
                    
                    await self.channel.default_exchange.publish(
                        aio_pika.Message(
                            body=error_payload,
                            correlation_id=message.correlation_id,
                        ),
                        routing_key=message.reply_to,
                    )

    async def start(self):
        """Запуск воркера с автоматическим переподключением"""
        while True:
            try:
                log.info("Connecting to RabbitMQ...")
                self.connection = await aio_pika.connect_robust(self.rabbitmq_url)
                
                async with self.connection:
                    self.channel = await self.connection.channel()
                    # Ограничиваем количество сообщений "в работе" для одного воркера
                    await self.channel.set_qos(prefetch_count=1)
                    
                    queue = await self.channel.declare_queue(self.queue_name, durable=True)
                    log.info(f"[*] ChatWorker is online. Listening to '{self.queue_name}'")
                    
                    async with queue.iterator() as queue_iter:
                        async for message in queue_iter:
                            await self.process_message(message)
                            
            except (aio_pika.exceptions.AMQPError, asyncio.CancelledError) as e:
                if isinstance(e, asyncio.CancelledError):
                    break
                log.warning(f"Connection lost. Retrying in 5s... Error: {e}")
                await asyncio.sleep(5)

async def main():
    worker = ChatWorker()
    await worker.start()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("Worker stopped.")
