import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  listContainers,
  createContainer,
  deleteContainer,
  setContainerStatus,
  listPublicNodes,
} from "../api/requests";
import type { Container, ContainerStatus, CreateContainerPayload, Node } from "../api/requests";
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
  PENDING: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]",
  ERROR:   "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]",
  UNKNOWN: "bg-slate-500",
};

const STATUS_BADGE: Record<ContainerStatus, string> = {
  RUNNING: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  STOPPED: "bg-gray-100 text-gray-600 border border-gray-200",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  ERROR:   "bg-red-50 text-red-700 border border-red-200",
  UNKNOWN: "bg-slate-100 text-slate-600 border border-slate-200",
};

function formatRAM(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB` : `${mb} MB`;
}

// ── Empty form state ──────────────────────────────────────────────────────────
const EMPTY_FORM: CreateContainerPayload = {
  name: "",
  node_id: "",
  image: "ubuntu:22.04",
  cpu: 1,
  ram: 1024,
  disk: 20,
  start_script: "",
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [form, setForm] = useState<CreateContainerPayload>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Per-card action loading
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // ── Auth guard ──
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

  // ── Search filter ──
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

  // ── Open modal ──
  async function openModal() {
    setForm(EMPTY_FORM);
    setCreateError(null);
    setModalOpen(true);
    try {
      const n = await listPublicNodes();
      setNodes(n ?? []);
      if (n?.length > 0) setForm((f) => ({ ...f, node_id: n[0].node_id }));
    } catch {
      setNodes([]);
    }
  }

  // ── Create ──
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const c = await createContainer(form);
      setContainers((prev) => [c, ...prev]);
      setModalOpen(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Ошибка создания");
    } finally {
      setCreating(false);
    }
  }

  // ── Delete ──
  async function handleDelete(id: string) {
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

  // ── Toggle status ──
  async function handleToggle(c: Container) {
    const next: ContainerStatus = c.status === "RUNNING" ? "STOPPED" : "RUNNING";
    setActionLoading((p) => ({ ...p, [c.container_id]: true }));
    try {
      await setContainerStatus(c.container_id, next);
      setContainers((prev) =>
        prev.map((x) => (x.container_id === c.container_id ? { ...x, status: next } : x)),
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка изменения статуса");
    } finally {
      setActionLoading((p) => ({ ...p, [c.container_id]: false }));
    }
  }

  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-all duration-200 focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 placeholder:text-gray-400";

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
              {!loading && `${containers.length} сервер${containers.length === 1 ? "" : containers.length < 5 ? "а" : "ов"}`}
            </p>
          </div>

          <div className="flex gap-3">
            {/* Search */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск серверов…"
                className="rounded-xl border border-white/15 bg-white/10 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-red-200/40 outline-none backdrop-blur-sm transition focus:border-white/30 focus:bg-white/15 w-56"
              />
            </div>

            {/* Create button */}
            <button
              onClick={openModal}
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-red-900 shadow-lg transition hover:bg-red-50 hover:shadow-red-900/20"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Создать сервер
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col items-center py-24 text-red-200/50">
            <svg className="mb-3 h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Загрузка…
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-red-900/30 px-6 py-5 text-center text-sm text-red-300 backdrop-blur-sm">
            {error}
            <button onClick={load} className="ml-3 underline hover:no-underline">Повторить</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
              <svg className="h-8 w-8 text-red-300/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h13.5a3 3 0 0 1 3 3v5.25a3 3 0 0 1-3 3m-13.5 0v3.75m13.5-3.75v3.75m-13.5 0h13.5" />
              </svg>
            </div>
            <p className="text-white/60">
              {search ? "Серверы не найдены" : "У вас пока нет серверов"}
            </p>
            {!search && (
              <button onClick={openModal} className="mt-4 rounded-xl bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
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
                onToggle={() => handleToggle(c)}
                onDelete={() => handleDelete(c.container_id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Create modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div className="animate-slide-up w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-black text-red-900">Создать сервер</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleCreate} className="space-y-4 px-6 py-5">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">Название</label>
                <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="my-server" className={inputCls} />
              </div>

              {/* Node */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">Узел</label>
                {nodes.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-400">Нет доступных узлов</p>
                ) : (
                  <select value={form.node_id} onChange={(e) => setForm((f) => ({ ...f, node_id: e.target.value }))} className={inputCls + " cursor-pointer"}>
                    {nodes.map((n) => (
                      <option key={n.node_id} value={n.node_id}>
                        {n.name} — {n.ip_address} ({n.cpu_cores} CPU / {formatRAM(n.ram)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Image */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">Образ</label>
                <input type="text" required value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} placeholder="ubuntu:22.04" className={inputCls} />
              </div>

              {/* CPU / RAM / Disk row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-600">CPU</label>
                  <input type="number" min={1} max={64} required value={form.cpu} onChange={(e) => setForm((f) => ({ ...f, cpu: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-600">RAM (МБ)</label>
                  <input type="number" min={128} max={131072} required value={form.ram} onChange={(e) => setForm((f) => ({ ...f, ram: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-600">Диск (ГБ)</label>
                  <input type="number" min={1} max={2048} required value={form.disk} onChange={(e) => setForm((f) => ({ ...f, disk: Number(e.target.value) }))} className={inputCls} />
                </div>
              </div>

              {/* Start script */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-600">
                  Скрипт запуска <span className="text-gray-400">(необязательно)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.start_script}
                  onChange={(e) => setForm((f) => ({ ...f, start_script: e.target.value }))}
                  placeholder="#!/bin/bash"
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-xs outline-none transition-all duration-200 focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 placeholder:text-gray-400"
                />
              </div>

              {createError && (
                <div className="animate-fade-slide-in rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {createError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creating || nodes.length === 0}
                  className="group relative flex-1 overflow-hidden rounded-xl bg-red-900 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-60"
                >
                  <span className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-white/10 transition-transform duration-500 group-hover:translate-x-[200%]" />
                  <span className="relative">{creating ? "Создание…" : "Создать"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Server card ───────────────────────────────────────────────────────────────
interface CardProps {
  container: Container;
  loading: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

function ServerCard({ container: c, loading, onToggle, onDelete }: CardProps) {
  const canToggle = c.status === "RUNNING" || c.status === "STOPPED";

  return (
    <div className="animate-fade-slide-in flex flex-col rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md transition hover:border-white/20 hover:bg-white/8 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
      {/* Card header */}
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${STATUS_DOT[c.status]}`} />
            <h3 className="truncate font-bold text-white">{c.name}</h3>
          </div>
          <p className="mt-0.5 truncate text-xs text-red-200/50">{c.image}</p>
        </div>
        <span className={`ml-2 flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[c.status]}`}>
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
        <p className="mx-5 mt-2 font-mono text-xs text-red-200/40">{c.ip_address}</p>
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
            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : c.status === "RUNNING" ? (
            <>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
              Остановить
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              Запустить
            </>
          )}
        </button>

        <button
          onClick={onDelete}
          disabled={loading}
          className="flex items-center justify-center rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/25 disabled:opacity-40"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
          </svg>
        </button>
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
