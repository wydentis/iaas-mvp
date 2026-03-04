import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Button } from '../../components/common/Button';
import './Dashboard.css';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const { data } = await api.get('/vps');
      setServers(data);
    } catch (error) {
      console.error('Failed to load servers:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'RUNNING': 'green',
      'STOPPED': 'gray',
      'PENDING': 'orange',
      'ERROR': 'red',
      'UNKNOWN': 'gray'
    };
    return colors[status] || 'gray';
  };

  const filteredServers = servers.filter(server =>
    server.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => navigate('/servers/create')}>
          + Создать сервер
        </Button>
      </div>

      <h2>Облачные серверы</h2>

      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : servers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-placeholder"></div>
          <p>У вас пока нет серверов</p>
          <Button onClick={() => navigate('/servers/create')}>
            Создать первый сервер
          </Button>
        </div>
      ) : (
        <div className="servers-grid">
          {filteredServers.map(server => (
            <div
              key={server.container_id}
              className="server-card"
              onClick={() => navigate(`/servers/${server.container_id}`)}
            >
              <div className="server-header">
                <div className="server-icon" style={{ background: getStatusColor(server.status) }}>
                  {server.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="server-info">
                  <h3>{server.name}</h3>
                  <span className={`status status-${server.status.toLowerCase()}`}>
                    {server.status === 'RUNNING' ? 'В сети' : server.status}
                  </span>
                </div>
              </div>
              <div className="server-details">
                <div className="detail-item">
                  <span>ОС</span>
                  <strong>{server.image}</strong>
                </div>
                <div className="detail-item">
                  <span>CPU</span>
                  <strong>{server.cpu} ГГц</strong>
                </div>
                <div className="detail-item">
                  <span>RAM</span>
                  <strong>{(server.ram / 1024).toFixed(0)} ГБ</strong>
                </div>
                <div className="detail-item">
                  <span>Диск</span>
                  <strong>{server.disk} ГБ</strong>
                </div>
                <div className="detail-item">
                  <span>IP</span>
                  <strong>{server.ip_address || 'N/A'}</strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
