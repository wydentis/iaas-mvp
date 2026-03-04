import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Button } from '../../components/common/Button';
import './Admin.css';

export const AdminContainers = () => {
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContainers();
  }, []);

  const loadContainers = async () => {
    try {
      const { data } = await api.get('/admin/containers');
      setContainers(data);
    } catch (error) {
      console.error('Failed to load containers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="admin-page">
      <h1>Все контейнеры</h1>

      <div className="admin-stats">
        <div className="stat-card">
          <h3>Всего</h3>
          <div className="stat-value">{containers.length}</div>
        </div>
        <div className="stat-card">
          <h3>Запущено</h3>
          <div className="stat-value">{containers.filter(c => c.status === 'RUNNING').length}</div>
        </div>
        <div className="stat-card">
          <h3>Остановлено</h3>
          <div className="stat-value">{containers.filter(c => c.status === 'STOPPED').length}</div>
        </div>
        <div className="stat-card">
          <h3>Ошибки</h3>
          <div className="stat-value">{containers.filter(c => c.status === 'ERROR').length}</div>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Имя</th>
              <th>User ID</th>
              <th>Node ID</th>
              <th>Образ</th>
              <th>CPU</th>
              <th>RAM</th>
              <th>Диск</th>
              <th>IP</th>
              <th>Статус</th>
              <th>Создан</th>
            </tr>
          </thead>
          <tbody>
            {containers.map(container => (
              <tr key={container.container_id}>
                <td>{container.container_id.substring(0, 8)}...</td>
                <td><strong>{container.name}</strong></td>
                <td>{container.user_id.substring(0, 8)}...</td>
                <td>{container.node_id.substring(0, 8)}...</td>
                <td>{container.image}</td>
                <td>{container.cpu}</td>
                <td>{(container.ram / 1024).toFixed(0)} ГБ</td>
                <td>{container.disk} ГБ</td>
                <td>{container.ip_address || 'N/A'}</td>
                <td>
                  <span className={`status-badge status-${container.status.toLowerCase()}`}>
                    {container.status}
                  </span>
                </td>
                <td>{new Date(container.created_at).toLocaleDateString('ru-RU')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
