import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  listContainers,
  deleteContainer,
  setContainerStatus,
} from "../api/requests";
import type { Container, ContainerStatus } from "../api/requests";
import { getCookie } from "../utils/cookies";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<ContainerStatus, string> = {
  RUNNING: "Работает",
  STOPPED: "Остановлен",
  PENDING: "Ожидание",
  ERROR: "Ошибка",
  UNKNOWN: "Неизвестно",
};

const STATUS_DOT: Record<ContainerStatus, string> = {
  RUNNING: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
  STOPPED: "bg-gray-400",
  PENDING: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse",
  ERROR: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]",
  UNKNOWN: "bg-slate-500",
};

const STATUS_BADGE: Record<ContainerStatus, string> = {
  RUNNING: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  STOPPED: "bg-gray-100 text-gray-600 border border-gray-200",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  ERROR: "bg-red-50 text-red-700 border border-red-200",
  UNKNOWN: "bg-slate-100 text-slate-600 border border-slate-200",
};

function formatRAM(mb: number): string {
  return mb >= 1024
    ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} ГБ`
    : `${mb} МБ`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!getCookie("access_token")) { navigate("/"); return; }
    load();
  }, [navigate]);
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listContainers();
      setContainers(data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return containers;
    return containers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.image.toLowerCase().includes(q) ||
        c.ip_address.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q),
    );
  }, [containers, search]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Удалить сервер? Это действие необратимо.")) return;
    setActionLoading((p) => ({ ...p, [id]: true }));
    try {
      await deleteContainer(id);
      setContainers((prev) => prev.filter((c) => c.container_id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка удаления");
    } finally {
      setActionLoading((p) => ({ ...p, [id]: false }));
    }
  }

  async function handleToggle(c: Container, e: React.MouseEvent) {
    e.stopPropagation();
    const next: ContainerStatus =
      c.status === "RUNNING" ? "STOPPED" : "RUNNING";
    setActionLoading((p) => ({ ...p, [c.container_id]: true }));
    try {
      await setContainerStatus(c.container_id, next);
      setContainers((prev) =>
        prev.map((x) =>
          x.container_id === c.container_id ? { ...x, status: next } : x,
        ),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка изменения статуса");
    } finally {
      setActionLoading((p) => ({ ...p, [c.container_id]: false }));
    }
  }

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* ── Top bar ── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">Мои серверы</h1>
            <p className="mt-0.5 text-sm text-red-200/50">
              {!loading &&
                `${containers.length} сервер${containers.length === 1 ? "" : containers.length < 5 ? "а" : "ов"}`}
            </p>
          </div>

          <div className="flex gap-3">
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z"
                />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск серверов…"
                className="w-56 rounded-xl border border-white/15 bg-white/10 py-2.5 pr-4 pl-9 text-sm text-white backdrop-blur-sm transition outline-none placeholder:text-red-200/40 focus:border-white/30 focus:bg-white/15"
              />
            </div>

            {/* Create button */}
            <button
              onClick={() => navigate("/servers/new")}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-red-900 shadow-lg transition hover:bg-red-50 hover:shadow-red-900/20"
            >
              <span className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-red-100/50 transition-transform duration-500 group-hover:translate-x-[200%]" />
              <svg
                className="relative h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              <span className="relative">Создать сервер</span>
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center py-24 text-red-200/50">
            <svg
              className="mb-3 h-8 w-8 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            Загрузка…
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-red-900/30 px-6 py-5 text-center text-sm text-red-300 backdrop-blur-sm">
            {error}
            <button
              onClick={load}
              className="ml-3 underline hover:no-underline"
            >
              Повторить
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <svg
                className="h-8 w-8 text-red-300/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v5.25a3 3 0 0 1-3 3m-13.5 0v3.75m13.5-3.75v3.75m-13.5 0h13.5"
                />
              </svg>
            </div>
            <p className="text-white/60">
              {search ? "Серверы не найдены" : "У вас пока нет серверов"}
            </p>
            {!search && (
              <button
                onClick={() => navigate("/servers/new")}
                className="mt-4 rounded-xl bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Создать первый сервер
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <ServerCard
                key={c.container_id}
                container={c}
                loading={!!actionLoading[c.container_id]}
                onToggle={(e) => handleToggle(c, e)}
                onDelete={(e) => handleDelete(c.container_id, e)}
                onClick={() => navigate(`/servers/${c.container_id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Server card ───────────────────────────────────────────────────────────────
interface CardProps {
  container: Container;
  loading: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onClick: () => void;
}

function ServerCard({
  container: c,
  loading,
  onToggle,
  onDelete,
  onClick,
}: CardProps) {
  const canToggle = c.status === "RUNNING" || c.status === "STOPPED";

  return (
    <div
      onClick={onClick}
      className="animate-fade-slide-in group flex cursor-pointer flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition hover:border-red-500/30 hover:bg-white/8 hover:shadow-[0_8px_32px_rgba(180,0,0,0.2)]"
    >
      {/* Card header */}
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${STATUS_DOT[c.status]}`}
            />
            <h3 className="truncate font-bold text-white transition group-hover:text-red-100">
              {c.name}
            </h3>
          </div>
          <p className="mt-0.5 truncate text-xs text-red-200/50">{c.image}</p>
        </div>
        <span
          className={`ml-2 flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[c.status]}`}
        >
          {STATUS_LABEL[c.status]}
        </span>
      </div>

      {/* Specs */}
      <div className="mx-5 flex gap-2 border-t border-white/8 pt-3">
        <Chip icon="⚙️" label={`${c.cpu} CPU`} />
        <Chip icon="🧠" label={formatRAM(c.ram)} />
        <Chip icon="💾" label={`${c.disk} ГБ`} />
      </div>

      {/* IP */}
      {c.ip_address && (
        <p className="mx-5 mt-2 font-mono text-xs text-red-200/40">
          {c.ip_address}
        </p>
      )}

      {/* Actions */}
      <div className="mt-auto flex gap-2 border-t border-white/8 p-4">
        <button
          onClick={onToggle}
          disabled={loading || !canToggle}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition disabled:opacity-40 ${
            c.status === "RUNNING"
              ? "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
              : "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
          }`}
        >
          {loading ? (
            <svg
              className="h-3.5 w-3.5 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          ) : c.status === "RUNNING" ? (
            <>
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Остановить
            </>
          ) : (
            <>
              <svg
                className="h-3.5 w-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              Запустить
            </>
          )}
        </button>

        <button
          onClick={onDelete}
          disabled={loading}
          className="flex items-center justify-center rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/25 disabled:opacity-40"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Click hint */}
      <div className="border-t border-white/5 px-5 py-2 text-center text-[10px] text-white/20 transition group-hover:text-white/40">
        Нажмите для подробностей →
      </div>
    </div>
  );
}

function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded-lg bg-white/8 px-2 py-1 text-xs text-red-100/70">
      <span>{icon}</span>
      {label}
    </span>
  );
}
