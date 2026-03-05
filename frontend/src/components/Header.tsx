import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getBalance, getUserInfo, clearChatHistory } from "../api/requests";
import { getCookie, removeCookie } from "../utils/cookies";

export default function Header() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const isLoggedIn = !!getCookie("access_token");

  useEffect(() => {
    if (!isLoggedIn) return;
    getBalance()
      .then((b) => setBalance(b.amount))
      .catch(() => setBalance(null));
    getUserInfo()
      .then((u) => { setUsername(u.username); setIsAdmin(u.role === "admin"); })
      .catch(() => setUsername(null));
  }, [isLoggedIn]);

  async function handleSignOut() {
    if (isLoggedIn) {
      try {
        await clearChatHistory();
      } catch (e) {
        console.error("Failed to clear chat history", e);
      }
    }
    removeCookie("access_token");
    removeCookie("refresh_token");
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
      {/* Логотип */}
      <div className="flex flex-shrink-0 items-center gap-6">
        <Link to="/" className="flex items-center">
          <img src="/logo.svg" alt="Logo" className="h-8" />
        </Link>
        {isLoggedIn && (
          <nav className="hidden items-center gap-2 text-sm font-semibold text-gray-600 sm:flex">
            <Link
              to="/dashboard"
              className="rounded-lg px-3 py-2 transition hover:bg-red-50 hover:text-[#B42124]"
            >
              Панель
            </Link>
            <Link
              to="/networks"
              className="rounded-lg px-3 py-2 transition hover:bg-red-50 hover:text-[#B42124]"
            >
              Сети
            </Link>
            <Link
              to="/servers/new"
              className="rounded-lg px-3 py-2 transition hover:bg-red-50 hover:text-[#B42124]"
            >
              Новый сервер
            </Link>
          </nav>
        )}
      </div>

      {/* Правая часть */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        {isLoggedIn ? (
          <>
            {/* Balance + top-up */}
            <div className="flex items-center overflow-hidden rounded-xl border border-gray-200">
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700">
                <span className="text-xs text-gray-400">Баланс</span>
                <span className="font-semibold text-gray-900">
                  {balance !== null ? `${balance.toLocaleString()} BYN` : "—"}
                </span>
              </div>
              <Link
                to="/topup"
                className="flex items-center gap-1 border-l border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-[#B42124] transition hover:bg-red-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Пополнить
              </Link>
            </div>

            {isAdmin && (
              <Link
                to="/admin"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-[#B42124] transition hover:bg-red-100"
              >
                Админ
              </Link>
            )}
            <Link
              to="/profile"
              className="rounded-lg bg-[#B42124] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-800"
            >
              {username ?? "Аккаунт"}
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Выйти
            </button>
          </>
        ) : (
          <>
            <Link
              to="/signin"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Войти
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-[#B42124] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-800"
            >
              Регистрация
            </Link>
          </>
        )}
      </div>

      {/* Mobile nav */}
      {isLoggedIn && (
        <nav className="flex w-full items-center gap-2 overflow-x-auto pb-1 text-sm font-semibold text-gray-600 sm:hidden">
          <Link
            to="/dashboard"
            className="whitespace-nowrap rounded-lg px-3 py-2 transition hover:bg-red-50 hover:text-[#B42124]"
          >
            Панель
          </Link>
          <Link
            to="/networks"
            className="whitespace-nowrap rounded-lg px-3 py-2 transition hover:bg-red-50 hover:text-[#B42124]"
          >
            Сети
          </Link>
          <Link
            to="/servers/new"
            className="whitespace-nowrap rounded-lg px-3 py-2 transition hover:bg-red-50 hover:text-[#B42124]"
          >
            Новый сервер
          </Link>
          {isAdmin && (
            <Link
              to="/admin"
              className="whitespace-nowrap rounded-lg px-3 py-2 transition hover:bg-red-50 hover:text-[#B42124]"
            >
              Админ
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
