import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Header } from './components/layout/Header';
import { AIChat } from './components/common/AIChat';
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';
import { Dashboard } from './pages/Servers/Dashboard';
import { CreateServer } from './pages/Servers/CreateServer';
import { ServerDetails } from './pages/Servers/ServerDetails';
import { Profile } from './pages/Profile/Profile';
import { AdminUsers } from './pages/Admin/AdminUsers';
import { AdminContainers } from './pages/Admin/AdminContainers';
import { AdminNodes } from './pages/Admin/AdminNodes';
import './App.css';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-screen">Загрузка...</div>;
  }
  
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-screen">Загрузка...</div>;
  }
  
  return user && user.role === 'admin' ? children : <Navigate to="/" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="loading-screen">Загрузка...</div>;
  }
  
  return !user ? children : <Navigate to="/" />;
};

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      {user && <Header />}
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/servers/create" element={<PrivateRoute><CreateServer /></PrivateRoute>} />
        <Route path="/servers/:id" element={<PrivateRoute><ServerDetails /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        
        <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
        <Route path="/admin/containers" element={<AdminRoute><AdminContainers /></AdminRoute>} />
        <Route path="/admin/nodes" element={<AdminRoute><AdminNodes /></AdminRoute>} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {user && <AIChat />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}