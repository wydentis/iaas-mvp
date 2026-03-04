import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import Profile from "./pages/Profile";
import Dashboard from "./pages/Dashboard";
import NewServer from "./pages/NewServer";
import ServerDetail from "./pages/ServerDetail";
import TopUp from "./pages/TopUp";
import Admin from "./pages/Admin";
import Networks from "./pages/Networks";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/servers/new" element={<NewServer />} />
        <Route path="/servers/:id" element={<ServerDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/topup" element={<TopUp />} />
        <Route path="/networks" element={<Networks />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
