import { useState, useEffect, useRef } from 'react';

export const useTerminal = (containerId) => {
  const [logs, setLogs] = useState([]);
  const socket = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    socket.current = new WebSocket(`ws://localhost:8080/vps/${containerId}/terminal`);

    socket.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLogs((prev) => [...prev, data.output || data.error]);
    };

    return () => socket.current.close();
  }, [containerId]);

  const sendCommand = (command) => {
    socket.current.send(JSON.stringify({ command }));
  };

  return { logs, sendCommand };
};