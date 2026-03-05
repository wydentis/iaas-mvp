import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listPublicSnapshots,
  listMySnapshots,
  deleteSnapshot,
  type Snapshot,
} from "../api/requests";
import { getCookie } from "../utils/cookies";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";

function formatRAM(mb: number) {
  return mb >= 1024 ? `${mb / 1024} ГБ` : `${mb} МБ`;
}

export default function Marketplace() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"public" | "my">("public");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAuth = !!getCookie("access_token");

  useEffect(() => {
    load();
  }, [tab]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = tab === "my" ? await listMySnapshots() : await listPublicSnapshots();
      setSnapshots(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить снапшот?")) return;
    try {
      await deleteSnapshot(id);
      setSnapshots((prev) => prev.filter((s) => s.snapshot_id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка удаления");
    }
  }

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B42124]">
              Маркетплейс
            </p>
            <h1 className="text-3xl font-black text-gray-900">Снапшоты архитектур</h1>
            <p className="text-sm text-gray-500">
              Делитесь конфигурациями серверов и используйте готовые решения.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-red-200 hover:text-red-700"
          >
            ← Панель
          </button>
        </div>

        {isAuth && (
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setTab("public")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tab === "public"
                  ? "bg-red-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Публичные
            </button>
            <button
              onClick={() => setTab("my")}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tab === "my"
                  ? "bg-red-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Мои снапшоты
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Загрузка…</p>
        ) : snapshots.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-2xl ring-1 ring-black/5">
            <p className="text-lg font-bold text-gray-900">Пока нет снапшотов</p>
            <p className="mt-1 text-sm text-gray-500">
              {tab === "my"
                ? "Создайте снапшот из любого вашего сервера на странице деталей."
                : "Когда пользователи поделятся своими конфигурациями, они появятся здесь."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {snapshots.map((s) => (
              <div
                key={s.snapshot_id}
                className="flex flex-col rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/5"
              >
                <div className="mb-3 flex items-start justify-between">
                  <h3 className="text-sm font-bold text-gray-900">{s.name}</h3>
                  {s.is_public && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Публичный
                    </span>
                  )}
                </div>
                {s.description && (
                  <p className="mb-3 line-clamp-2 text-xs text-gray-500">{s.description}</p>
                )}
                <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-gray-50 p-2">
                    <span className="text-gray-400">Образ</span>
                    <div className="font-semibold text-gray-800">{s.image}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <span className="text-gray-400">CPU</span>
                    <div className="font-semibold text-gray-800">{s.cpu} ядер</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <span className="text-gray-400">RAM</span>
                    <div className="font-semibold text-gray-800">{formatRAM(s.ram)}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2">
                    <span className="text-gray-400">Диск</span>
                    <div className="font-semibold text-gray-800">{s.disk} ГБ</div>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-[11px] text-gray-400">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex gap-2">
                    {isAuth && (
                      <button
                        onClick={() =>
                          navigate("/servers/new", {
                            state: { fromSnapshot: s },
                          })
                        }
                        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-800"
                      >
                        Развернуть
                      </button>
                    )}
                    {tab === "my" && (
                      <button
                        onClick={() => handleDelete(s.snapshot_id)}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
