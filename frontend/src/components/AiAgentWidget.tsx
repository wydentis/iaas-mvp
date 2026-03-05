import { useEffect, useRef, useState } from "react";
import { createAiChatSocket } from "../api/requests";
import { getCookie } from "../utils/cookies";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

function messageStyle(role: ChatMessage["role"]) {
  if (role === "user") return "ml-8 self-end bg-[#B42124] text-white";
  if (role === "assistant") return "mr-8 self-start bg-red-50 text-gray-800";
  return "self-center bg-gray-100 text-gray-600";
}

export default function AiAgentWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "hello", role: "assistant", text: "Привет! Я AI-консультант. Чем могу помочь?" },
  ]);
  const [isConnected, setIsConnected] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const isLoggedIn = !!getCookie("access_token");

  useEffect(() => {
    if (!isOpen || !isLoggedIn) return;

    let ws: WebSocket;
    try {
      ws = createAiChatSocket();
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-ws-init`, role: "system", text: "Не удалось открыть AI соединение" },
      ]);
      setIsConnected(false);
      return;
    }
    wsRef.current = ws;
    setIsConnected(false);

    ws.onopen = () => setIsConnected(true);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          status?: string;
          response?: string;
          error?: string;
        };
        setIsPending(false);
        if (data.status === "success" && typeof data.response === "string") {
          const responseText = data.response;
          setMessages((prev) => [
            ...prev,
            { id: `${Date.now()}-ai`, role: "assistant", text: responseText },
          ]);
          return;
        }
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-err`, role: "system", text: data.error || "Ошибка ответа AI" },
        ]);
      } catch {
        setIsPending(false);
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-parse`, role: "system", text: "Некорректный формат ответа сервера" },
        ]);
      }
    };
    ws.onerror = () => {
      setIsConnected(false);
      setIsPending(false);
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-ws-error`, role: "system", text: "Ошибка подключения к AI чату" },
      ]);
    };
    ws.onclose = () => setIsConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
      setIsConnected(false);
      setIsPending(false);
    };
  }, [isOpen, isLoggedIn]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isPending]);

  function sendMessage() {
    const text = input.trim();
    if (!text || isPending) return;

    if (!isLoggedIn) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-auth`, role: "system", text: "Сначала войдите в аккаунт" },
      ]);
      setInput("");
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-not-open`, role: "system", text: "AI чат ещё подключается. Попробуйте снова." },
      ]);
      return;
    }

    setMessages((prev) => [...prev, { id: `${Date.now()}-user`, role: "user", text }]);
    wsRef.current.send(JSON.stringify({ message: text }));
    setInput("");
    setIsPending(true);
  }

  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-[80] flex flex-col items-end gap-3">
      {isOpen && (
        <div className="pointer-events-auto w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-4 py-3">
            <div>
              <p className="text-sm font-black text-[#B42124]">AI-консультант</p>
              <p className="text-[11px] text-gray-500">{isConnected ? "онлайн" : "подключение..."}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg px-2 py-1 text-xs font-bold text-gray-500 transition hover:bg-red-100 hover:text-[#B42124]"
            >
              ✕
            </button>
          </div>

          <div ref={listRef} className="flex max-h-[52vh] min-h-[220px] flex-col gap-2 overflow-y-auto px-3 py-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`max-w-[82%] rounded-xl px-3 py-2 text-xs leading-relaxed ${messageStyle(msg.role)}`}>
                {msg.text}
              </div>
            ))}
            {isPending && (
              <div className="mr-8 self-start rounded-xl bg-red-50 px-3 py-2 text-xs text-gray-500">
                AI думает...
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Напишите вопрос..."
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900 outline-none transition focus:border-[#B42124] focus:bg-white focus:ring-2 focus:ring-red-100"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isPending || !input.trim()}
                className="rounded-xl bg-[#B42124] px-3 py-2 text-xs font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Отпр.
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="pointer-events-auto rounded-full bg-[#B42124] px-5 py-3 text-sm font-black text-white shadow-xl shadow-red-900/30 transition hover:bg-red-800"
      >
        Спросить у ИИ
      </button>
    </div>
  );
}
