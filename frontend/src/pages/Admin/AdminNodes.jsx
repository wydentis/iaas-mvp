import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Button } from '../../components/common/Button';
import './Admin.css';

export const AdminNodes = () => {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    status: 'active',
    cpu_cores: 16,
    ram: 32768,
    disk_space: 500
  });

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      const { data } = await api.get('/admin/nodes');
      setNodes(data);
    } catch (error) {
      console.error('Failed to load nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNode = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/nodes', formData);
      setShowCreateModal(false);
      setFormData({
        name: '',
        ip_address: '',
        status: 'active',
        cpu_cores: 16,
        ram: 32768,
        disk_space: 500
      });
      loadNodes();
      alert('Нода создана');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка создания ноды');
    }
  };

  const deleteNode = async (id) => {
    if (!confirm('Удалить ноду?')) return;
    try {
      await api.delete(`/admin/nodes/${id}`);
      loadNodes();
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Управление нодами</h1>
        <Button onClick={() => setShowCreateModal(true)}>+ Добавить ноду</Button>
      </div>

      <div className="admin-stats">
        <div className="stat-card">
          <h3>Всего нод</h3>
          <div className="stat-value">{nodes.length}</div>
        </div>
        <div className="stat-card">
          <h3>Активных</h3>
          <div className="stat-value">{nodes.filter(n => n.status === 'active').length}</div>
        </div>
        <div className="stat-card">
          <h3>Всего CPU</h3>
          <div className="stat-value">{nodes.reduce((sum, n) => sum + n.cpu_cores, 0)}</div>
        </div>
        <div className="stat-card">
          <h3>Всего RAM</h3>
          <div className="stat-value">{(nodes.reduce((sum, n) => sum + n.ram, 0) / 1024).toFixed(0)} ГБ</div>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Имя</th>
              <th>IP адрес</th>
              <th>CPU</th>
              <th>RAM</th>
              <th>Диск</th>
              <th>Статус</th>
              <th>Создана</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map(node => (
              <tr key={node.node_id}>
                <td>{node.node_id.substring(0, 8)}...</td>
                <td><strong>{node.name}</strong></td>
                <td>{node.ip_address}</td>
                <td>{node.cpu_cores} ядер</td>
                <td>{(node.ram / 1024).toFixed(0)} ГБ</td>
                <td>{node.disk_space} ГБ</td>
                <td>
                  <span className={`status-badge status-${node.status}`}>
                    {node.status}
                  </span>
                </td>
                <td>{new Date(node.created_at).toLocaleDateString('ru-RU')}</td>
                <td>
                  <button onClick={() => deleteNode(node.node_id)} className="delete-btn">
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Добавить ноду</h2>
            <form onSubmit={createNode}>
              <div className="form-group">
                <label>Имя</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>IP адрес</label>
                <input
                  type="text"
                  value={formData.ip_address}
                  onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>CPU ядер</label>
                <input
                  type="number"
                  value={formData.cpu_cores}
                  onChange={(e) => setFormData({ ...formData, cpu_cores: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div className="form-group">
                <label>RAM (МБ)</label>
                <input
                  type="number"
                  value={formData.ram}
                  onChange={(e) => setFormData({ ...formData, ram: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Диск (ГБ)</label>
                <input
                  type="number"
                  value={formData.disk_space}
                  onChange={(e) => setFormData({ ...formData, disk_space: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div className="form-actions">
                <Button type="submit">Создать</Button>
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Отмена
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
