import os
import json
import redis.asyncio as redis # Using the async version of redis-py
import asyncio
import aio_pika
from google import genai
from google.genai import types

# --- Configuration & Clients ---
# We use async Redis to avoid blocking the event loop
r = redis.from_url(
    os.getenv('REDIS_URL', 'redis://localhost:6379'), 
    decode_responses=True
)

client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
MODEL_ID = os.getenv('AI_MODEL_NAME', 'gemini-2.0-flash')
RABBITMQ_URL = os.getenv('RABBITMQ_URL', 'amqp://guest:guest@localhost/')
QUEUE_NAME = os.getenv("CONSULTER_RESPONSE_QUEUE", "chat_requests")

# --- Helper Logic (Async) ---
async def save_message(user_id: str, role: str, content: str):
    data = json.dumps({"role": role, "content": content})
    key = f"chat:{user_id}"
    await r.rpush(key, data)
    await r.ltrim(key, -20, -1)
    await r.expire(key, 86400)

async def get_formatted_history(user_id: str, limit: int = 10):
    raw_history = await r.lrange(f"chat:{user_id}", -limit, -1)
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

# --- AI Worker Logic ---
async def process_message(message: aio_pika.IncomingMessage):
    async with message.process():
        try:
            body = json.loads(message.body.decode())
            user_id = body.get("user_id")
            user_text = body.get("message")

            if not user_id or not user_text:
                return

            # 1. Get History (Don't save the new message yet!)
            chat_history = await get_formatted_history(user_id, limit=10)

            # 2. Gemini Interaction
            # Using run_in_executor to keep the loop responsive during the API call
            loop = asyncio.get_event_loop()
            try:
                response = await loop.run_in_executor(
                    None, 
                    lambda: client.chats.create(model=MODEL_ID, history=chat_history).send_message(user_text)
                )
                ai_text = response.text
            except Exception as ai_err:
                # If AI fails, we trigger the specific error reply logic
                raise RuntimeError(f"AI Generation Failed: {ai_err}")

            # 3. Save BOTH messages only on SUCCESS
            # We wrap these in a gather to ensure both are handled
            await asyncio.gather(
                save_message(user_id, "user", user_text),
                save_message(user_id, "model", ai_text)
            )

            # 4. Success Reply
            if message.reply_to:
                await message.channel.default_exchange.publish(
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
            print(f"Error processing message: {e}")
            
            # 5. Error Reply to RabbitMQ
            if message.reply_to:
                error_payload = json.dumps({
                    "user_id": body.get("user_id") if 'body' in locals() else "unknown",
                    "status": "error",
                    "code": 500,
                    "message": "Failed to generate AI response. History was not updated."
                }).encode()

                await message.channel.default_exchange.publish(
                    aio_pika.Message(
                        body=error_payload,
                        correlation_id=message.correlation_id,
                    ),
                    routing_key=message.reply_to,
                )

async def main():
    # Setup RabbitMQ Connection
    connection = await aio_pika.connect_robust(RABBITMQ_URL)
    channel = await connection.channel()
    
    # Ensure the queue exists
    queue = await channel.declare_queue(QUEUE_NAME, durable=True)

    print(f" [*] Waiting for messages in {QUEUE_NAME}. To exit press CTRL+C")

    # Start consuming
    await queue.consume(process_message)

    # Keep the worker running
    try:
        await asyncio.Future()
    finally:
        await connection.close()

if __name__ == "__main__":
    asyncio.run(main())