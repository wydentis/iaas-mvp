import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Header.css';

export const Header = () => {
  const { user, balance, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <div className="logo-text">
            ПЛОТИНА<br/>СЕРВЕРОВ
          </div>
        </Link>

        <div className="header-right">
          <div className="balance-display">
            <span className="balance-icon">💳</span>
            <span className="balance-amount">{balance} ₽</span>
            <span className="balance-days">4 дня</span>
          </div>

          <div className="user-menu">
            <span className="username">{user.username}</span>
            <div className="user-dropdown">
              <Link to="/profile">Профиль</Link>
              {user.role === 'admin' && (
                <>
                  <Link to="/admin/users">Пользователи</Link>
                  <Link to="/admin/containers">Контейнеры</Link>
                  <Link to="/admin/nodes">Ноды</Link>
                </>
              )}
              <button onClick={handleLogout}>Выйти</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
