import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changeBalance } from "../api/requests";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";

const PRESETS = [5, 10, 20, 50, 100, 200];

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 placeholder:text-gray-400";

export default function TopUp() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectPreset(val: number) {
    setAmount(String(val));
    setError(null);
    setSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseInt(amount, 10);
    if (!num || num <= 0) {
      setError("Введите сумму больше 0");
      return;
    }
    if (num > 1000000) {
      setError("Максимальная сумма пополнения — 1 000 000 BYN");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await changeBalance(num);
      setSuccess(true);
      setAmount("");
      setTimeout(() => navigate("/dashboard"), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка пополнения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <AnimatedBackground />
      <Header />

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="animate-fade-slide-in w-full max-w-md">
          {/* Card */}
          <div className="rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            {/* Header */}
            <div className="border-b border-gray-100 px-7 py-6">
              <div className="mb-1 flex items-center gap-3">
                <h1 className="text-2xl font-black text-red-700">
                  Пополнение баланса
                </h1>
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Средства зачисляются мгновенно
              </p>
            </div>

            <div className="px-7 py-6">
              {/* Preset chips */}
              <p className="mb-3 text-xs font-semibold tracking-wider text-gray-400 uppercase">
                Быстрый выбор
              </p>
              <div className="mb-6 grid grid-cols-3 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => selectPreset(p)}
                    className={`rounded-xl border py-2.5 text-sm font-bold transition-all duration-150 ${
                      amount === String(p)
                        ? "border-red-700 bg-red-700 text-white shadow-[0_0_12px_rgba(153,27,27,0.35)]"
                        : "border-gray-200 bg-gray-50 text-gray-700 hover:border-red-300 hover:bg-red-50 hover:text-red-800"
                    }`}
                  >
                    {p.toLocaleString()} BYN
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-600">
                    Или введите сумму вручную
                  </label>
                  <div className="relative">
                    <span className="absolute top-1/2 left-80 -translate-y-1/2 text-sm font-semibold text-gray-400">
                      BYN
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={1000000}
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setError(null);
                        setSuccess(false);
                      }}
                      placeholder="0"
                      className={inputCls + " pl-3"}
                    />
                  </div>
                </div>

                {error && (
                  <div className="animate-fade-slide-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="animate-fade-slide-in rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                    ✓ Баланс пополнен! Переход в панель…
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !amount}
                  className="group relative w-full overflow-hidden rounded-xl bg-red-700 py-3 text-sm font-bold text-white transition-all hover:bg-red-800 disabled:opacity-50"
                >
                  <span className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-white/10 transition-transform duration-500 group-hover:translate-x-[200%]" />
                  <span className="relative">
                    {loading
                      ? "Пополнение…"
                      : amount
                        ? `Пополнить на ${parseInt(amount || "0").toLocaleString()} BYN`
                        : "Пополнить баланс"}
                  </span>
                </button>
              </form>
            </div>
          </div>

          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm text-[#B42124]/50 transition hover:text-[#B42124]/80"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}
