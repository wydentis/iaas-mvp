import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getBalance } from "../api/requests";
import { getCookie, removeCookie } from "../utils/cookies";

export default function Header() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const isLoggedIn = !!getCookie("access_token");

  useEffect(() => {
    if (!isLoggedIn) return;
    getBalance()
      .then((b) => setBalance(b.amount))
      .catch(() => setBalance(null));
  }, [isLoggedIn]);

  function handleSignOut() {
    removeCookie("access_token");
    removeCookie("refresh_token");
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-red-900/40 bg-red-950/90 px-6 backdrop-blur-sm">
      {/* Логотип */}
      <Link to="/" className="flex items-center gap-2.5 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-rose-700 text-sm font-black shadow-[0_0_12px_rgba(225,29,72,0.5)]">
          I
        </span>
        <span className="hidden text-base font-black tracking-tight sm:block">
          IaaS MVP
        </span>
      </Link>

      {/* Правая часть */}
      <div className="flex items-center gap-2">
        {isLoggedIn ? (
          <>
            {/* Balance + top-up */}
            <div className="flex items-center overflow-hidden rounded-xl border border-white/15">
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white">
                <span className="text-xs text-red-300">Баланс</span>
                <span className="font-semibold">
                  {balance !== null ? `${balance.toLocaleString()} BYN` : "—"}
                </span>
              </div>
              <Link
                to="/topup"
                className="flex items-center gap-1 border-l border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Пополнить
              </Link>
            </div>

            <Link
              to="/dashboard"
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              Панель
            </Link>
            <Link
              to="/profile"
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-900 transition hover:bg-red-100"
            >
              Аккаунт
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              Выйти
            </button>
          </>
        ) : (
          <>
            <Link
              to="/signin"
              className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              Войти
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-red-900 transition hover:bg-red-100"
            >
              Регистрация
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
