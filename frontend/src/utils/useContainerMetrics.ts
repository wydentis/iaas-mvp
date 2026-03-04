import { useEffect, useRef, useState } from "react";
import { getCookie } from "./cookies";

export interface MetricsPoint {
  timestamp: number;
  cpu_percent: number;
  ram_percent: number;
  disk_usage_bytes: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
}

const MAX_POINTS = 60;
const BASE_URL = import.meta.env.DEV
  ? "ws://localhost:5173/api"
  : "wss://serverdam.wydentis.xyz/api";

export function useContainerMetrics(containerId: string, enabled: boolean) {
  const [history, setHistory] = useState<MetricsPoint[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !containerId) return;

    const token = getCookie("access_token") ?? "";
    const url = `${BASE_URL}/vps/${containerId}/metrics?token=${encodeURIComponent(token)}&refresh_ms=1000`;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setError(null);
    setHistory([]);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.error) { setError(data.error); return; }
        const m = data.metrics ?? data;
        const point: MetricsPoint = {
          timestamp:         data.timestamp ?? Date.now(),
          cpu_percent:       m.cpu_percent   ?? 0,
          ram_percent:       m.ram_percent   ?? 0,
          disk_usage_bytes:  m.disk_usage_bytes ?? 0,
          network_rx_bytes:  m.network_rx_bytes ?? 0,
          network_tx_bytes:  m.network_tx_bytes ?? 0,
        };
        setHistory((prev) => [...prev.slice(-(MAX_POINTS - 1)), point]);
      } catch { /* ignore malformed frames */ }
    };

    ws.onerror = () => setError("Ошибка подключения к потоку метрик");
    ws.onclose = () => setConnected(false);

    return () => {
      ws.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [containerId, enabled]);

  return { history, connected, error };
}
