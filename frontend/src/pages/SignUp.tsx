import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../api/requests";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";

interface FormData {
  username: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  password: string;
  password_confirm: string;
}

const INITIAL: FormData = {
  username: "",
  name: "",
  surname: "",
  email: "",
  phone: "",
  password: "",
  password_confirm: "",
};

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 placeholder:text-gray-400";

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormData>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = {
      ...form,
      username: form.username.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      name: form.name.trim(),
      surname: form.surname.trim(),
    };

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed.username)) {
      setError("Логин: 3-30 символов (буквы, цифры, _)");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed.email)) {
      setError("Некорректный email");
      return;
    }
    if (!/^\+?[0-9\s\-()]{7,20}$/.test(trimmed.phone)) {
      setError("Некорректный номер телефона");
      return;
    }
    if (!trimmed.name || !trimmed.surname) {
      setError("Имя и фамилия обязательны");
      return;
    }
    if (form.password.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }
    if (form.password !== form.password_confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      await signUp(trimmed);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <AnimatedBackground />
      <Header />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg rounded-2xl bg-white px-8 py-10 shadow-2xl ring-1 ring-black/5">
          {/* Title */}
          <h1 className="mb-1 text-center text-3xl font-black tracking-tight text-red-700">
            Регистрация
          </h1>
          <p className="mb-8 text-center text-sm text-gray-400">
            Создайте аккаунт
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row: Имя пользователя (full width) */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-600">
                Имя пользователя
              </label>
              <input
                type="text"
                name="username"
                required
                value={form.username}
                onChange={handleChange}
                placeholder="Придумайте логин"
                className={inputCls}
              />
            </div>

            {/* Row: Имя + Фамилия */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">
                  Имя
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ваше имя"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">
                  Фамилия
                </label>
                <input
                  type="text"
                  name="surname"
                  required
                  value={form.surname}
                  onChange={handleChange}
                  placeholder="Ваша фамилия"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row: Email + Телефон */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">
                  Телефон
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+375 (29) 123-45-67"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Row: Пароль + Подтверждение */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">
                  Пароль
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Придумайте пароль"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">
                  Подтверждение
                </label>
                <input
                  type="password"
                  name="password_confirm"
                  required
                  value={form.password_confirm}
                  onChange={handleChange}
                  placeholder="Повторите пароль"
                  className={inputCls}
                />
              </div>
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
              <span className="relative">
                {loading ? "Создание аккаунта…" : "Зарегистрироваться"}
              </span>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Уже есть аккаунт?{" "}
            <Link
              to="/signin"
              className="font-semibold text-red-700 hover:underline"
            >
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
