import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getContainer,
  deleteContainer,
  setContainerStatus,
  getPortMappings,
  createPortMapping,
  deletePortMapping,
  runCommand,
  updateContainerInfo,
} from "../api/requests";
import type { Container, ContainerStatus, PortMapping } from "../api/requests";
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

const STATUS_COLOR: Record<ContainerStatus, string> = {
  RUNNING: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  STOPPED: "bg-gray-500/20 text-gray-300 border border-gray-500/30",
  PENDING: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  ERROR: "bg-red-500/20 text-red-300 border border-red-500/30",
  UNKNOWN: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
};

const STATUS_DOT: Record<ContainerStatus, string> = {
  RUNNING: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]",
  STOPPED: "bg-gray-400",
  PENDING: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse",
  ERROR: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]",
  UNKNOWN: "bg-slate-500",
};

const OS_ICONS: Record<string, string> = {
  ubuntu: "🟠", debian: "🔴", alpine: "🔵", centos: "💜",
  fedora: "🔵", arch: "🔷", windows: "🪟", default: "🖥️",
};

function getOsIcon(image: string) {
  const key = image.toLowerCase().split(":")[0];
  return OS_ICONS[key] ?? OS_ICONS.default;
}

function formatRAM(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} ГБ` : `${mb} МБ`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [container, setContainer] = useState<Container | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Rename
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Port mappings
  const [ports, setPorts] = useState<PortMapping[]>([]);
  const [portsLoading] = useState(false);
  const [showAddPort, setShowAddPort] = useState(false);
  const [newPort, setNewPort] = useState({ container_port: "", host_port: "", protocol: "tcp" });
  const [addingPort, setAddingPort] = useState(false);
  const [portError, setPortError] = useState<string | null>(null);

  // Run command
  const [cmd, setCmd] = useState("");
  const [cmdOutput, setCmdOutput] = useState<string | null>(null);
  const [cmdRunning, setCmdRunning] = useState(false);
  const [cmdError, setCmdError] = useState<string | null>(null);

  // ── Auth guard + load ──
  useEffect(() => {
    if (!getCookie("access_token")) { navigate("/"); return; }
    if (!id) { navigate("/dashboard"); return; }
    loadAll();
  }, [id, navigate]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [c, p] = await Promise.all([
        getContainer(id!),
        getPortMappings(id!).catch(() => [] as PortMapping[]),
      ]);
      setContainer(c);
      setPorts(p);
      setNameInput(c.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  // ── Actions ──
  async function handleToggle() {
    if (!container) return;
    const next: ContainerStatus = container.status === "RUNNING" ? "STOPPED" : "RUNNING";
    setActionLoading(true);
    try {
      await setContainerStatus(container.container_id, next);
      setContainer((c) => c ? { ...c, status: next } : c);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!container) return;
    if (!confirm("Удалить сервер? Это действие необратимо.")) return;
    setActionLoading(true);
    try {
      await deleteContainer(container.container_id);
      navigate("/dashboard");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка удаления");
      setActionLoading(false);
    }
  }

  async function handleSaveName() {
    if (!container || !nameInput.trim()) return;
    setSavingName(true);
    try {
      await updateContainerInfo(container.container_id, nameInput.trim());
      setContainer((c) => c ? { ...c, name: nameInput.trim() } : c);
      setEditingName(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSavingName(false);
    }
  }

  // ── Port mappings ──
  async function handleAddPort(e: React.FormEvent) {
    e.preventDefault();
    setPortError(null);
    setAddingPort(true);
    try {
      const pm = await createPortMapping(id!, {
        container_port: Number(newPort.container_port),
        host_port: newPort.host_port ? Number(newPort.host_port) : undefined,
        protocol: newPort.protocol,
      });
      setPorts((p) => [...p, pm]);
      setShowAddPort(false);
      setNewPort({ container_port: "", host_port: "", protocol: "tcp" });
    } catch (e) {
      setPortError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setAddingPort(false);
    }
  }

  async function handleDeletePort(mappingId: string) {
    if (!confirm("Удалить маппинг порта?")) return;
    try {
      await deletePortMapping(id!, mappingId);
      setPorts((p) => p.filter((x) => x.id !== mappingId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  }

  // ── Run command ──
  async function handleRunCmd(e: React.FormEvent) {
    e.preventDefault();
    if (!cmd.trim()) return;
    setCmdError(null);
    setCmdOutput(null);
    setCmdRunning(true);
    try {
      const out = await runCommand(id!, cmd);
      setCmdOutput(out);
    } catch (e) {
      setCmdError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setCmdRunning(false);
    }
  }

  // ── Styles ──
  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 placeholder:text-white/30 backdrop-blur-sm";

  // ── Loading / error ──
  if (loading) return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />
      <div className="flex h-[60vh] items-center justify-center">
        <svg className="h-8 w-8 animate-spin text-red-300/60" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </div>
    </div>
  );

  if (error || !container) return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-red-300">{error ?? "Сервер не найден"}</p>
        <button onClick={() => navigate("/dashboard")} className="rounded-xl bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/15">
          ← Назад к панели
        </button>
      </div>
    </div>
  );

  const canToggle = container.status === "RUNNING" || container.status === "STOPPED";

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-10">
        {/* ── Breadcrumb ── */}
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-6 flex items-center gap-2 text-sm text-red-200/50 transition hover:text-red-200/80"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
          Панель управления
        </button>

        {/* ── Hero card ── */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: name + status */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-red-900/40 text-2xl border border-red-800/30">
                {getOsIcon(container.image)}
              </div>
              <div>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                      className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xl font-black text-white outline-none focus:border-red-500/50"
                    />
                    <button onClick={handleSaveName} disabled={savingName} className="rounded-lg bg-red-900/60 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-800/80 disabled:opacity-50">
                      {savingName ? "…" : "Сохранить"}
                    </button>
                    <button onClick={() => setEditingName(false)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/15">
                      Отмена
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-white">{container.name}</h1>
                    <button
                      onClick={() => setEditingName(true)}
                      className="rounded-lg p-1.5 text-white/30 transition hover:bg-white/10 hover:text-white/60"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[container.status]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[container.status]}`} />
                    {STATUS_LABEL[container.status]}
                  </span>
                  <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-red-100/60 font-mono">{container.image}</span>
                </div>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex flex-shrink-0 gap-2">
              {canToggle && (
                <button
                  onClick={handleToggle}
                  disabled={actionLoading}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                    container.status === "RUNNING"
                      ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/20"
                      : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/20"
                  }`}
                >
                  {actionLoading ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : container.status === "RUNNING" ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                  ) : (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  )}
                  {container.status === "RUNNING" ? "Остановить" : "Запустить"}
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                </svg>
                Удалить
              </button>
            </div>
          </div>
        </div>

        {/* ── Info grid ── */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoCard icon="⚙️" label="Процессоры" value={`${container.cpu} ядер`} />
          <InfoCard icon="🧠" label="Память" value={formatRAM(container.ram)} />
          <InfoCard icon="💾" label="Диск SSD" value={`${container.disk} ГБ`} />
          <InfoCard
            icon="🌐"
            label="IP-адрес"
            value={container.ip_address || "—"}
            mono
          />
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <InfoCard icon="🔑" label="ID контейнера" value={container.container_id} mono small />
          <InfoCard icon="📅" label="Создан" value={formatDate(container.created_at)} />
        </div>

        {/* ── Port Mappings ── */}
        <Section title="Проброс портов" icon="🔌">
          {portsLoading ? (
            <p className="text-sm text-white/40">Загрузка…</p>
          ) : (
            <>
              {ports.length > 0 && (
                <div className="mb-4 overflow-hidden rounded-xl border border-white/8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-white/5">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/50">Хост порт</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/50">Контейнер порт</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-white/50">Протокол</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-white/50" />
                      </tr>
                    </thead>
                    <tbody>
                      {ports.map((p) => (
                        <tr key={p.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition">
                          <td className="px-4 py-3 font-mono text-white">{p.host_port}</td>
                          <td className="px-4 py-3 font-mono text-white/70">{p.container_port}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-red-900/30 px-2 py-0.5 text-xs font-semibold uppercase text-red-300">{p.protocol}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeletePort(p.id)}
                              className="text-white/30 transition hover:text-red-400"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!showAddPort ? (
                <button
                  onClick={() => setShowAddPort(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white/80"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Добавить маппинг
                </button>
              ) : (
                <form onSubmit={handleAddPort} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-white/50">Порт контейнера *</label>
                    <input
                      type="number"
                      required
                      min={1} max={65535}
                      value={newPort.container_port}
                      onChange={(e) => setNewPort((p) => ({ ...p, container_port: e.target.value }))}
                      className={inputCls + " w-36"}
                      placeholder="80"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-white/50">Порт хоста (авто)</label>
                    <input
                      type="number"
                      min={1} max={65535}
                      value={newPort.host_port}
                      onChange={(e) => setNewPort((p) => ({ ...p, host_port: e.target.value }))}
                      className={inputCls + " w-36"}
                      placeholder="авто"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-white/50">Протокол</label>
                    <select
                      value={newPort.protocol}
                      onChange={(e) => setNewPort((p) => ({ ...p, protocol: e.target.value }))}
                      className={inputCls + " w-28 cursor-pointer"}
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                  </div>
                  <button type="submit" disabled={addingPort} className="rounded-xl bg-red-900/60 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800/80 disabled:opacity-50">
                    {addingPort ? "…" : "Добавить"}
                  </button>
                  <button type="button" onClick={() => { setShowAddPort(false); setPortError(null); }} className="rounded-xl bg-white/8 px-4 py-2.5 text-sm text-white/60 transition hover:bg-white/12">
                    Отмена
                  </button>
                  {portError && <p className="w-full text-xs text-red-400">{portError}</p>}
                </form>
              )}
            </>
          )}
        </Section>

        {/* ── Run command ── */}
        <Section title="Выполнить команду" icon="⌨️">
          <form onSubmit={handleRunCmd} className="flex gap-3">
            <input
              type="text"
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              placeholder="ls -la / или cat /etc/os-release"
              className={inputCls + " flex-1 font-mono text-xs"}
            />
            <button
              type="submit"
              disabled={cmdRunning || !cmd.trim()}
              className="flex-shrink-0 rounded-xl bg-red-900/60 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800/80 disabled:opacity-50"
            >
              {cmdRunning ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : "Запустить"}
            </button>
          </form>
          {cmdError && <p className="mt-2 text-xs text-red-400">{cmdError}</p>}
          {cmdOutput !== null && (
            <pre className="mt-3 max-h-60 overflow-auto rounded-xl bg-black/40 p-4 font-mono text-xs text-green-300 scrollbar-thin">
              {cmdOutput || "(нет вывода)"}
            </pre>
          )}
        </Section>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function InfoCard({ icon, label, value, mono, small }: { icon: string; label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-white/40">
        <span>{icon}</span>
        {label}
      </div>
      <p className={`font-semibold text-white truncate ${mono ? "font-mono" : ""} ${small ? "text-xs" : "text-base"}`}>
        {value}
      </p>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
      <h2 className="mb-4 flex items-center gap-2 font-bold text-white">
        <span className="text-lg">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}
