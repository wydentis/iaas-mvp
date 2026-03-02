import asyncio
import json
import uuid
import aio_pika

async def send_request():
    connection = await aio_pika.connect_robust("amqp://guest:guest@localhost/")
    async with connection:
        channel = await connection.channel()
        
        # 1. Create a temporary, exclusive queue for the response
        callback_queue = await channel.declare_queue(exclusive=True)
        
        corr_id = str(uuid.uuid4())
        future = asyncio.get_event_loop().create_future()

        # 2. Response handler
        async def on_response(message: aio_pika.IncomingMessage):
            if message.correlation_id == corr_id:
                future.set_result(json.loads(message.body.decode('utf-8')))

        await callback_queue.consume(on_response, no_ack=True)

        # 3. Send the request
        payload = {"text": "I need a server for a high-traffic PostgreSQL DB and a Python API"}
        await channel.default_exchange.publish(
            aio_pika.Message(
                body=json.dumps(payload).encode(),
                reply_to=callback_queue.name,
                correlation_id=corr_id,
            ),
            routing_key="hardware_requests",
        )

        print(" [x] Request sent. Waiting for Gemini...")
        response = await asyncio.wait_for(future, timeout=60.0)
        print(f" [.] 5000 бунов спизжно:\n{response}")

if __name__ == "__main__":
    asyncio.run(send_request())