import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';
import { Button } from '../../components/common/Button';
import './Profile.css';

export const Profile = () => {
  const { user, refreshBalance } = useAuth();
  const [editMode, setEditMode] = useState({ personal: false, login: false, password: false });
  const [personalData, setPersonalData] = useState({
    name: '',
    surname: ''
  });
  const [loginData, setLoginData] = useState({
    username: ''
  });
  const [passwordData, setPasswordData] = useState({
    password: '',
    password_confirm: ''
  });
  const [balanceAmount, setBalanceAmount] = useState('');

  useEffect(() => {
    if (user) {
      setPersonalData({ name: user.name, surname: user.surname });
      setLoginData({ username: user.username });
    }
  }, [user]);

  const updatePersonal = async () => {
    try {
      await api.put('/user/info', personalData);
      setEditMode({ ...editMode, personal: false });
      alert('Личные данные обновлены');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка обновления');
    }
  };

  const updateLogin = async () => {
    try {
      await api.put('/user/info', loginData);
      setEditMode({ ...editMode, login: false });
      alert('Логин обновлен');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка обновления');
    }
  };

  const updatePassword = async () => {
    if (passwordData.password !== passwordData.password_confirm) {
      alert('Пароли не совпадают');
      return;
    }
    try {
      await api.put('/user/pass', passwordData);
      setEditMode({ ...editMode, password: false });
      setPasswordData({ password: '', password_confirm: '' });
      alert('Пароль обновлен');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка обновления');
    }
  };

  const addBalance = async () => {
    if (!balanceAmount || parseFloat(balanceAmount) <= 0) {
      alert('Введите корректную сумму');
      return;
    }
    try {
      await api.put('/user/balance', { amount: parseFloat(balanceAmount) });
      setBalanceAmount('');
      refreshBalance();
      alert('Баланс пополнен');
    } catch (error) {
      alert(error.response?.data?.error || 'Ошибка пополнения');
    }
  };

  if (!user) return <div className="loading">Загрузка...</div>;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="profile-avatar">📷</div>
        <div>
          <h1>{user.name} {user.surname}</h1>
          <p>{user.email}</p>
        </div>
      </div>

      <div className="profile-content">
        <h2>Управление</h2>

        <div className="profile-section">
          <div className="section-header">
            <div className="section-icon">👤</div>
            <div>
              <h3>Личные данные</h3>
              <p>{user.name} {user.surname}</p>
            </div>
            {!editMode.personal && (
              <Button variant="secondary" size="small" onClick={() => setEditMode({ ...editMode, personal: true })}>
                Изменить
              </Button>
            )}
          </div>
          {editMode.personal && (
            <div className="edit-form">
              <div className="form-group">
                <label>Имя</label>
                <input
                  type="text"
                  value={personalData.name}
                  onChange={(e) => setPersonalData({ ...personalData, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Фамилия</label>
                <input
                  type="text"
                  value={personalData.surname}
                  onChange={(e) => setPersonalData({ ...personalData, surname: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <Button onClick={updatePersonal}>Сохранить</Button>
                <Button variant="secondary" onClick={() => setEditMode({ ...editMode, personal: false })}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="profile-section">
          <div className="section-header">
            <div className="section-icon">🔑</div>
            <div>
              <h3>Логин аккаунта</h3>
              <p>{user.username}</p>
            </div>
            {!editMode.login && (
              <Button variant="secondary" size="small" onClick={() => setEditMode({ ...editMode, login: true })}>
                Изменить
              </Button>
            )}
          </div>
          {editMode.login && (
            <div className="edit-form">
              <div className="form-group">
                <label>Логин</label>
                <input
                  type="text"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ username: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <Button onClick={updateLogin}>Сохранить</Button>
                <Button variant="secondary" onClick={() => setEditMode({ ...editMode, login: false })}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="profile-section">
          <div className="section-header">
            <div className="section-icon">🔒</div>
            <div>
              <h3>Пароль</h3>
              <p>••••••••</p>
            </div>
            {!editMode.password && (
              <Button variant="secondary" size="small" onClick={() => setEditMode({ ...editMode, password: true })}>
                Изменить
              </Button>
            )}
          </div>
          {editMode.password && (
            <div className="edit-form">
              <div className="form-group">
                <label>Новый пароль</label>
                <input
                  type="password"
                  value={passwordData.password}
                  onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Повторите пароль</label>
                <input
                  type="password"
                  value={passwordData.password_confirm}
                  onChange={(e) => setPasswordData({ ...passwordData, password_confirm: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <Button onClick={updatePassword}>Сохранить</Button>
                <Button variant="secondary" onClick={() => setEditMode({ ...editMode, password: false })}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="profile-section">
          <div className="section-header">
            <div className="section-icon">💳</div>
            <div>
              <h3>Баланс</h3>
              <p>Пополнить баланс</p>
            </div>
          </div>
          <div className="balance-form">
            <input
              type="number"
              placeholder="Сумма"
              value={balanceAmount}
              onChange={(e) => setBalanceAmount(e.target.value)}
            />
            <Button onClick={addBalance}>Пополнить</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
