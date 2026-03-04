import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signIn } from "../api/requests";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";

type Mode = "username" | "email" | "phone";

const MODES: { key: Mode; label: string; type: string; placeholder: string }[] =
  [
    {
      key: "username",
      label: "Логин",
      type: "text",
      placeholder: "Введите логин",
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      placeholder: "you@example.com",
    },
    {
      key: "phone",
      label: "Телефон",
      type: "tel",
      placeholder: "+375 (29) 123-45-67",
    },
  ];

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 placeholder:text-gray-400";

export default function SignIn() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("username");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleModeChange(next: Mode) {
    setMode(next);
    setIdentifier("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn({ [mode]: identifier, password });
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  const current = MODES.find((m) => m.key === mode)!;

  return (
    <div className="relative flex min-h-screen flex-col">
      <AnimatedBackground />
      <Header />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white px-8 py-10 shadow-2xl ring-1 ring-black/5">
          {/* Title */}
          <h1 className="mb-1 text-center text-3xl font-black tracking-tight text-red-700">
            Войти
          </h1>
          <p className="mb-8 text-center text-sm text-gray-400">
            Войдите в свой аккаунт
          </p>

          {/* Mode selector */}
          <div className="mb-6 flex rounded-xl bg-gray-100 p-1">
            {MODES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleModeChange(key)}
                className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-200 ${
                  mode === key
                    ? "bg-white text-red-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Animated identifier field */}
            <div key={mode} className="animate-fade-slide-in">
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                {current.label}
              </label>
              <input
                type={current.type}
                required
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={current.placeholder}
                className={inputCls}
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                Пароль
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                className={inputCls}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="animate-fade-slide-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-xl bg-red-700 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-red-800 disabled:opacity-60"
            >
              <span className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-white/10 transition-transform duration-500 group-hover:translate-x-[200%]" />
              <span className="relative">{loading ? "Вход…" : "Войти"}</span>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Нет аккаунта?{" "}
            <Link
              to="/signup"
              className="font-semibold text-red-700 hover:underline"
            >
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
