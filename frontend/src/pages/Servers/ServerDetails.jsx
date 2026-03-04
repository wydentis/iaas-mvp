import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { WebSocketClient } from '../../utils/websocket';
import { Button } from '../../components/common/Button';
import './ServerDetails.css';

export const ServerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [server, setServer] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [ports, setPorts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [terminalInput, setTerminalInput] = useState('');
  const terminalWs = useRef(null);
  const metricsWs = useRef(null);

  useEffect(() => {
    loadServer();
    loadPorts();
    return () => {
      if (terminalWs.current) terminalWs.current.close();
      if (metricsWs.current) metricsWs.current.close();
    };
  }, [id]);

  useEffect(() => {
    if (activeTab === 'metrics' && server?.status === 'RUNNING') {
      connectMetrics();
    }
  }, [activeTab, server]);

  const loadServer = async () => {
    try {
      const { data } = await api.get(`/vps/${id}`);
      setServer(data);
    } catch (error) {
      console.error('Failed to load server:', error);
    }
  };

  const loadPorts = async () => {
    try {
      const { data } = await api.get(`/vps/${id}/ports`);
      setPorts(data || []);
    } catch (error) {
      console.error('Failed to load ports:', error);
    }
  };

  const connectMetrics = async () => {
    const token = localStorage.getItem('access_token');
    const ws = new WebSocketClient(`ws://localhost:8080/vps/${id}/metrics`, token);
    
    try {
      await ws.connect();
      ws.on('message', (data) => {
        setMetrics(data);
      });
      metricsWs.current = ws;
    } catch (error) {
      console.error('Metrics WebSocket failed:', error);
    }
  };

  const connectTerminal = async () => {
    const token = localStorage.getItem('access_token');
    const ws = new WebSocketClient(`ws://localhost:8080/vps/${id}/terminal`, token);
    
    try {
      await ws.connect();
      setTerminalOutput(prev => [...prev, { type: 'system', text: 'Терминал подключен' }]);
      
      ws.on('message', (data) => {
        if (data.output) {
          setTerminalOutput(prev => [...prev, { type: 'output', text: data.output }]);
        }
        if (data.error) {
          setTerminalOutput(prev => [...prev, { type: 'error', text: data.error }]);
        }
      });

      terminalWs.current = ws;
    } catch (error) {
      setTerminalOutput(prev => [...prev, { type: 'error', text: 'Ошибка подключения к терминалу' }]);
    }
  };

  const sendTerminalCommand = () => {
    if (!terminalInput.trim() || !terminalWs.current) return;
    
    setTerminalOutput(prev => [...prev, { type: 'input', text: `$ ${terminalInput}` }]);
    terminalWs.current.send({ command: terminalInput });
    setTerminalInput('');
  };

  const handleStatusChange = async (status) => {
    try {
      await api.put(`/vps/${id}/status`, { status });
      loadServer();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка изменения статуса');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить сервер?')) return;
    
    try {
      await api.delete(`/vps/${id}`);
      navigate('/');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const addPort = async () => {
    const containerPort = prompt('Порт контейнера:');
    if (!containerPort) return;

    try {
      await api.post(`/vps/${id}/ports`, {
        container_port: parseInt(containerPort),
        protocol: 'tcp'
      });
      loadPorts();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка добавления порта');
    }
  };

  const deletePort = async (portId) => {
    try {
      await api.delete(`/vps/${id}/ports/${portId}`);
      loadPorts();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка удаления порта');
    }
  };

  if (!server) return <div className="loading">Загрузка...</div>;

  return (
    <div className="server-details">
      <div className="server-header">
        <button onClick={() => navigate('/')} className="back-btn">← Назад</button>
        <div className="server-title">
          <div className="server-icon" style={{ background: server.status === 'RUNNING' ? '#4caf50' : '#757575' }}>
            {server.name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1>{server.name}</h1>
            <span className={`status status-${server.status.toLowerCase()}`}>
              {server.status === 'RUNNING' ? 'В сети' : server.status}
            </span>
          </div>
        </div>

        <div className="server-actions">
          <button onClick={() => handleStatusChange('RUNNING')} disabled={server.status === 'RUNNING'}>
            ▶ Запустить
          </button>
          <button onClick={() => handleStatusChange('STOPPED')} disabled={server.status === 'STOPPED'}>
            ⏸ Остановить
          </button>
          <button onClick={() => navigate(`/servers/${id}/resize`)}>
            ⚙ Изменить
          </button>
          <button onClick={() => window.open(`http://${server.ip_address}`, '_blank')}>
            🌐 Открыть
          </button>
          <button onClick={handleDelete} className="danger">
            🗑 Удалить
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
          Дашборд
        </button>
        <button className={activeTab === 'info' ? 'active' : ''} onClick={() => setActiveTab('info')}>
          Инфо
        </button>
        <button className={activeTab === 'network' ? 'active' : ''} onClick={() => setActiveTab('network')}>
          Сеть
        </button>
        <button className={activeTab === 'console' ? 'active' : ''} onClick={() => setActiveTab('console')}>
          Консоль
        </button>
        <button className={activeTab === 'backup' ? 'active' : ''} onClick={() => setActiveTab('backup')}>
          Бэкапы
        </button>
        <button className={activeTab === 'snapshots' ? 'active' : ''} onClick={() => setActiveTab('snapshots')}>
          Снапшоты
        </button>
        <button className={activeTab === 'config' ? 'active' : ''} onClick={() => setActiveTab('config')}>
          Конфигурация
        </button>
        <button className={activeTab === 'metrics' ? 'active' : ''} onClick={() => setActiveTab('metrics')}>
          История
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'dashboard' && (
          <div className="dashboard-tab">
            <div className="metrics-grid">
              <div className="metric-card">
                <h3>Загрузка CPU</h3>
                <div className="metric-chart">
                  <div className="chart-placeholder">График загрузки процессора</div>
                </div>
              </div>
              <div className="metric-card">
                <h3>Использование диска</h3>
                <div className="disk-usage">
                  <div className="disk-circle">
                    <span className="percentage">4%</span>
                    <span className="label">Занято</span>
                  </div>
                  <div className="disk-stats">
                    <div><strong>1.6 ГБ</strong> Занято</div>
                    <div><strong>48.4 ГБ</strong> Свободно</div>
                    <div><strong>50 ГБ</strong> Всего</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="metrics-grid">
              <div className="metric-card">
                <h3>Трафик (1000 Мбит/с)</h3>
                <div className="metric-chart">
                  <div className="chart-placeholder">График сетевого трафика</div>
                </div>
              </div>
              <div className="metric-card">
                <h3>IP Адреса</h3>
                <div className="ip-info">
                  <div className="ip-item">
                    <strong>IPv4</strong>
                    <span>{server.ip_address || 'Не назначен'}</span>
                    <button onClick={() => navigator.clipboard.writeText(server.ip_address)}>📋</button>
                  </div>
                  <div className="ip-item">
                    <strong>SSH</strong>
                    <span>ssh root@{server.ip_address}</span>
                    <button onClick={() => navigator.clipboard.writeText(`ssh root@${server.ip_address}`)}>📋</button>
                  </div>
                  <div className="ip-item">
                    <strong>Root пароль</strong>
                    <span>••••••••</span>
                    <button>👁</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'info' && (
          <div className="info-tab">
            <div className="info-grid">
              <div className="info-item">
                <label>ID</label>
                <span>{server.container_id}</span>
              </div>
              <div className="info-item">
                <label>Имя</label>
                <span>{server.name}</span>
              </div>
              <div className="info-item">
                <label>Образ</label>
                <span>{server.image}</span>
              </div>
              <div className="info-item">
                <label>CPU</label>
                <span>{server.cpu} ядер</span>
              </div>
              <div className="info-item">
                <label>RAM</label>
                <span>{(server.ram / 1024).toFixed(0)} ГБ</span>
              </div>
              <div className="info-item">
                <label>Диск</label>
                <span>{server.disk} ГБ</span>
              </div>
              <div className="info-item">
                <label>IP адрес</label>
                <span>{server.ip_address || 'N/A'}</span>
              </div>
              <div className="info-item">
                <label>Создан</label>
                <span>{new Date(server.created_at).toLocaleString('ru-RU')}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="network-tab">
            <div className="section-header">
              <h3>Порты</h3>
              <Button onClick={addPort}>+ Добавить порт</Button>
            </div>
            <table className="ports-table">
              <thead>
                <tr>
                  <th>Хост порт</th>
                  <th>Порт контейнера</th>
                  <th>Протокол</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {ports.map(port => (
                  <tr key={port.id}>
                    <td>{port.host_port}</td>
                    <td>{port.container_port}</td>
                    <td>{port.protocol.toUpperCase()}</td>
                    <td>
                      <button onClick={() => deletePort(port.id)} className="danger-btn">Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'console' && (
          <div className="console-tab">
            <div className="terminal">
              {!terminalWs.current && (
                <Button onClick={connectTerminal}>Подключиться к терминалу</Button>
              )}
              {terminalWs.current && (
                <>
                  <div className="terminal-output">
                    {terminalOutput.map((line, idx) => (
                      <div key={idx} className={`terminal-line terminal-${line.type}`}>
                        {line.text}
                      </div>
                    ))}
                  </div>
                  <div className="terminal-input">
                    <span className="prompt">$</span>
                    <input
                      type="text"
                      value={terminalInput}
                      onChange={(e) => setTerminalInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendTerminalCommand()}
                      placeholder="Введите команду..."
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="config-tab">
            <h3>Изменить конфигурацию</h3>
            <p>Для изменения конфигурации используйте кнопку "Изменить" в шапке</p>
          </div>
        )}
      </div>
    </div>
  );
};
