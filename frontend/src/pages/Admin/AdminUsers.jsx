import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Button } from '../../components/common/Button';
import './Admin.css';

export const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async () => {
    if (!search.trim()) {
      loadUsers();
      return;
    }
    try {
      const { data } = await api.get(`/admin/user?query=${search}`);
      setUsers(Array.isArray(data) ? data : [data]);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div className="admin-page">
      <h1>Управление пользователями</h1>

      <div className="admin-header">
        <div className="search-container">
          <input
            type="text"
            placeholder="Поиск по username, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
          />
          <Button onClick={searchUsers}>Поиск</Button>
          <Button variant="secondary" onClick={loadUsers}>Сбросить</Button>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Имя</th>
              <th>Email</th>
              <th>Телефон</th>
              <th>Баланс</th>
              <th>Роль</th>
              <th>Создан</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.user_id}>
                <td>{user.user_id.substring(0, 8)}...</td>
                <td><strong>{user.username}</strong></td>
                <td>{user.name} {user.surname}</td>
                <td>{user.email}</td>
                <td>{user.phone}</td>
                <td>{user.balance} ₽</td>
                <td>
                  <span className={`role-badge role-${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString('ru-RU')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <div className="empty-state">Пользователи не найдены</div>
      )}
    </div>
  );
};
