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
  listNetworks,
  listNetworkContainers,
  listContainerNetworks,
  attachContainerToNetwork,
  detachContainerFromNetwork,
  updateContainerSpecs,
  updatePortMapping,
} from "../api/requests";
import type { Container, ContainerStatus, PortMapping, Network } from "../api/requests";
import type { MetricsPoint } from "../utils/useContainerMetrics";
import { getCookie } from "../utils/cookies";
import { useContainerMetrics } from "../utils/useContainerMetrics";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";
import Sparkline from "../components/Sparkline";

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<ContainerStatus, string> = {
  RUNNING: "Работает",
  STOPPED: "Остановлен",
  PENDING: "Ожидание",
  ERROR: "Ошибка",
  UNKNOWN: "Неизвестно",
};

const STATUS_COLOR: Record<ContainerStatus, string> = {
  RUNNING: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  STOPPED: "bg-gray-100 text-gray-600 border border-gray-200",
  PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
  ERROR: "bg-red-50 text-red-700 border border-red-200",
  UNKNOWN: "bg-slate-100 text-slate-600 border border-slate-200",
};

const STATUS_DOT: Record<ContainerStatus, string> = {
  RUNNING: "bg-emerald-500 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
  STOPPED: "bg-gray-400",
  PENDING: "bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse",
  ERROR: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]",
  UNKNOWN: "bg-slate-400",
};

const OS_ICONS: Record<string, string> = {
  ubuntu: "🟠",
  debian: "🔴",
  alpine: "🔵",
  centos: "💜",
  fedora: "🔵",
  arch: "🔷",
  windows: "🪟",
  default: "🖥️",
};

function getOsIcon(image: string) {
  const key = image.toLowerCase().split("/")[0];
  return OS_ICONS[key] ?? OS_ICONS.default;
}

function formatRAM(mb: number) {
  return mb >= 1024
    ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} ГБ`
    : `${mb} МБ`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Tab = "info" | "metrics" | "ports" | "networks" | "terminal";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "info", label: "Информация", icon: "ℹ️" },
  { key: "metrics", label: "Метрики", icon: "📈" },
  { key: "ports", label: "Порты", icon: "🔌" },
  { key: "networks", label: "Сети", icon: "🕸️" },
  { key: "terminal", label: "Терминал", icon: "⌨️" },
];

// ── Component ──────────────────────────────────────────────────────────────────
export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [container, setContainer] = useState<Container | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("info");

  // Metrics WebSocket — only connect when metrics tab is active and container is running
  const metricsEnabled =
    activeTab === "metrics" && container?.status === "RUNNING";
  const {
    history: metricsHistory,
    connected: metricsConnected,
    error: metricsError,
  } = useContainerMetrics(id ?? "", metricsEnabled);

  // Rename
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Port mappings
  const [ports, setPorts] = useState<PortMapping[]>([]);
  const [showAddPort, setShowAddPort] = useState(false);
  const [newPort, setNewPort] = useState({
    container_port: "",
    host_port: "",
    protocol: "tcp",
  });
  const [addingPort, setAddingPort] = useState(false);
  const [portError, setPortError] = useState<string | null>(null);
  const [editingPortId, setEditingPortId] = useState<string | null>(null);
  const [editPortForm, setEditPortForm] = useState({
    container_port: "",
    host_port: "",
    protocol: "tcp",
  });

  // Terminal
  const [cmd, setCmd] = useState("");
  const [cmdOutput, setCmdOutput] = useState<string | null>(null);
  const [cmdRunning, setCmdRunning] = useState(false);
  const [cmdError, setCmdError] = useState<string | null>(null);

  // Networks
  const [containerNetworks, setContainerNetworks] = useState<(Network & { ip_address?: string })[]>([]);
  const [allNetworks, setAllNetworks] = useState<Network[]>([]);
  const [networksLoading, setNetworksLoading] = useState(false);
  const [networksError, setNetworksError] = useState<string | null>(null);
  const [networkForm, setNetworkForm] = useState({ network_id: "", ip_address: "" });
  const [networkSaving, setNetworkSaving] = useState(false);

  // Specs update
  const [specForm, setSpecForm] = useState({ cpu: 0, ram: 0, disk: 0 });
  const [specSaving, setSpecSaving] = useState(false);

  useEffect(() => {
    if (!getCookie("access_token")) {
      navigate("/");
      return;
    }
    if (!id) {
      navigate("/dashboard");
      return;
    }
    loadAll();
  }, [id, navigate]);

  useEffect(() => {
    if (activeTab === "networks") {
      loadNetworksData();
    }
  }, [activeTab, id]);

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
      setSpecForm({ cpu: c.cpu, ram: c.ram, disk: c.disk });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  async function loadNetworksData() {
    if (!id) return;
    setNetworksLoading(true);
    setNetworksError(null);
    try {
      const [available, attached] = await Promise.all([
        listNetworks(),
        listContainerNetworks(id!),
      ]);
      const enriched = await Promise.all(
        (attached ?? []).map(async (net) => {
          try {
            const conts = await listNetworkContainers(net.network_id);
            const entry = conts.find((c) => c.container_id === id);
            return { ...net, ip_address: entry?.ip_address };
          } catch {
            return { ...net };
          }
        }),
      );
      setAllNetworks(available ?? []);
      setContainerNetworks(enriched);
      if (!networkForm.network_id && (available?.length ?? 0) > 0) {
        setNetworkForm((f) => ({ ...f, network_id: available![0].network_id }));
      }
    } catch (e) {
      setNetworksError(e instanceof Error ? e.message : "Ошибка загрузки сетей");
    } finally {
      setNetworksLoading(false);
    }
  }

  async function handleToggle() {
    if (!container) return;
    const next: ContainerStatus =
      container.status === "RUNNING" ? "STOPPED" : "RUNNING";
    setActionLoading(true);
    try {
      await setContainerStatus(container.container_id, next);
      setContainer((c) => (c ? { ...c, status: next } : c));
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
      setContainer((c) => (c ? { ...c, name: nameInput.trim() } : c));
      setEditingName(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSavingName(false);
    }
  }

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

  async function handleUpdatePort(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPortId) return;
    setPortError(null);
    try {
      const updated = await updatePortMapping(id!, editingPortId, {
        container_port: editPortForm.container_port ? Number(editPortForm.container_port) : undefined,
        host_port: editPortForm.host_port ? Number(editPortForm.host_port) : undefined,
        protocol: editPortForm.protocol,
      });
      setPorts((prev) => prev.map((p) => (p.id === editingPortId ? updated : p)));
      setEditingPortId(null);
      setEditPortForm({ container_port: "", host_port: "", protocol: "tcp" });
    } catch (e) {
      setPortError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function handleAttachNetwork(e: React.FormEvent) {
    e.preventDefault();
    if (!networkForm.network_id) return;
    setNetworkSaving(true);
    setNetworksError(null);
    try {
      await attachContainerToNetwork(networkForm.network_id, {
        container_id: id!,
        ip_address: networkForm.ip_address.trim() || undefined,
      });
      setNetworkForm((f) => ({ ...f, ip_address: "" }));
      await loadNetworksData();
    } catch (e) {
      setNetworksError(e instanceof Error ? e.message : "Не удалось подключить к сети");
    } finally {
      setNetworkSaving(false);
    }
  }

  async function handleDetachNetwork(netId: string) {
    if (!confirm("Отключить контейнер от сети?")) return;
    try {
      await detachContainerFromNetwork(netId, id!);
      setContainerNetworks((prev) => prev.filter((n) => n.network_id !== netId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось отключить");
    }
  }

  async function handleUpdateSpecs(e: React.FormEvent) {
    e.preventDefault();
    if (!container) return;
    setSpecSaving(true);
    try {
      await updateContainerSpecs(container.container_id, {
        cpu: Number(specForm.cpu),
        ram: Number(specForm.ram),
        disk: Number(specForm.disk),
      });
      setContainer((c) => (c ? { ...c, cpu: Number(specForm.cpu), ram: Number(specForm.ram), disk: Number(specForm.disk) } : c));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось обновить ресурсы");
    } finally {
      setSpecSaving(false);
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

  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 placeholder:text-gray-400";

  if (loading)
    return (
      <div className="relative min-h-screen">
        <AnimatedBackground />
        <Header />
        <div className="flex h-[60vh] items-center justify-center">
          <svg
            className="h-8 w-8 animate-spin text-red-300/60"
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
        </div>
      </div>
    );

  if (error || !container)
    return (
      <div className="relative min-h-screen">
        <AnimatedBackground />
        <Header />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-red-300">{error ?? "Сервер не найден"}</p>
          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-xl bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/15"
          >
            ← Назад к панели
          </button>
        </div>
      </div>
    );

  const canToggle =
    container.status === "RUNNING" || container.status === "STOPPED";

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-10">
        {/* ── Breadcrumb ── */}
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-6 flex items-center gap-2 text-sm text-[#B42124]/50 transition hover:text-[#B42124]/80"
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
              d="m15 18-6-6 6-6"
            />
          </svg>
          Панель управления
        </button>

        {/* ── Hero card ── */}
        <div className="mb-6 rounded-2xl bg-white px-8 py-6 shadow-2xl ring-1 ring-black/5">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            {/* Left: icon + name + status */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-2xl">
                {getOsIcon(container.image)}
              </div>
              <div>
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xl font-black text-gray-900 outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                    >
                      {savingName ? "…" : "Сохранить"}
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-600 transition hover:bg-gray-200"
                    >
                      Отмена
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black text-gray-900">
                      {container.name}
                    </h1>
                    <button
                      onClick={() => setEditingName(true)}
                      className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
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
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
                        />
                      </svg>
                    </button>
                  </div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[container.status]}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[container.status]}`}
                    />
                    {STATUS_LABEL[container.status]}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 font-mono text-xs text-gray-600">
                    {container.image}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex flex-shrink-0 gap-2">
              {canToggle && (
                <button
                  onClick={handleToggle}
                  disabled={actionLoading}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                    container.status === "RUNNING"
                      ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {actionLoading ? (
                    <svg
                      className="h-4 w-4 animate-spin"
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
                  ) : container.status === "RUNNING" ? (
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                  {container.status === "RUNNING" ? "Остановить" : "Запустить"}
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
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
                    d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"
                  />
                </svg>
                Удалить
              </button>
            </div>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="mb-6 rounded-2xl bg-white px-2 py-2 shadow-2xl ring-1 ring-black/5">
          <div className="flex rounded-xl bg-gray-100 p-1">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200 ${
                  activeTab === key
                    ? "bg-white text-red-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab: Info ── */}
        {activeTab === "info" && (
          <div className="rounded-2xl bg-white px-8 py-6 shadow-2xl ring-1 ring-black/5">
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoCard
                icon="⚙️"
                label="Процессоры"
                value={`${container.cpu} ядер`}
              />
              <InfoCard
                icon="🧠"
                label="Память"
                value={formatRAM(container.ram)}
              />
              <InfoCard
                icon="💾"
                label="Диск SSD"
                value={`${container.disk} ГБ`}
              />
              <InfoCard
                icon="🌐"
                label="IP-адрес"
                value={container.ip_address || "—"}
                mono
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                icon="🔑"
                label="ID контейнера"
                value={container.container_id}
                mono
                small
              />
              <InfoCard
                icon="📅"
                label="Создан"
                value={formatDate(container.created_at)}
              />
            </div>
            <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-800">
                Обновить ресурсы
              </h3>
              <form onSubmit={handleUpdateSpecs} className="mt-3 grid gap-3 sm:grid-cols-3">
                {([
                  { name: "cpu", label: "CPU (ядра)" },
                  { name: "ram", label: "RAM (МБ)" },
                  { name: "disk", label: "Диск (ГБ)" },
                ] as const).map(({ name, label }) => (
                  <div key={name}>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      {label}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={specForm[name]}
                      onChange={(e) =>
                        setSpecForm((prev) => ({ ...prev, [name]: Number(e.target.value) }))
                      }
                      className={inputCls}
                    />
                  </div>
                ))}
                <div className="sm:col-span-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={specSaving}
                    className="rounded-xl bg-[#B42124] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                  >
                    {specSaving ? "Сохранение…" : "Обновить"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSpecForm({ cpu: container.cpu, ram: container.ram, disk: container.disk })
                    }
                    className="rounded-xl bg-white px-4 py-2.5 text-sm text-gray-600 transition hover:bg-gray-100"
                  >
                    Сбросить
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Tab: Metrics ── */}
        {activeTab === "metrics" && (
          <MetricsTab
            status={container.status}
            history={metricsHistory}
            connected={metricsConnected}
            error={metricsError}
          />
        )}

        {/* ── Tab: Ports ── */}
        {activeTab === "ports" && (
          <div className="rounded-2xl bg-white px-8 py-6 shadow-2xl ring-1 ring-black/5">
            <h2 className="mb-4 text-lg font-bold text-gray-900">
              Проброс портов
            </h2>
            {ports.length > 0 && (
              <div className="mb-4 overflow-x-auto">
                <div className="min-w-[520px] overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                          Хост порт
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                          Контейнер порт
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">
                          Протокол
                        </th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500" />
                      </tr>
                    </thead>
                    <tbody>
                      {ports.map((p) => (
                        <tr
                          key={p.id}
                          className="border-b border-gray-50 transition last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 font-mono text-gray-900 break-words">
                            {p.host_port}
                          </td>
                          <td className="px-4 py-3 font-mono text-gray-600 break-words">
                            {p.container_port}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 uppercase">
                              {p.protocol}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-3">
                              <button
                                onClick={() => {
                                  setEditingPortId(p.id);
                                  setEditPortForm({
                                    container_port: String(p.container_port),
                                    host_port: p.host_port ? String(p.host_port) : "",
                                    protocol: p.protocol,
                                  });
                                }}
                                className="text-xs font-semibold text-gray-500 transition hover:text-red-700"
                              >
                                Изм.
                              </button>
                              <button
                                onClick={() => handleDeletePort(p.id)}
                                className="text-gray-400 transition hover:text-red-600"
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
                                    d="m19 7-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {!showAddPort ? (
              <button
                onClick={() => setShowAddPort(true)}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-800"
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
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Добавить маппинг
              </button>
            ) : (
              <form
                onSubmit={handleAddPort}
                className="flex flex-wrap items-end gap-3"
              >
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Порт контейнера *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={65535}
                    value={newPort.container_port}
                    onChange={(e) =>
                      setNewPort((p) => ({
                        ...p,
                        container_port: e.target.value,
                      }))
                    }
                    className={inputCls + " w-36"}
                    placeholder="80"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Порт хоста (авто)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={newPort.host_port}
                    onChange={(e) =>
                      setNewPort((p) => ({ ...p, host_port: e.target.value }))
                    }
                    className={inputCls + " w-36"}
                    placeholder="авто"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Протокол
                  </label>
                  <select
                    value={newPort.protocol}
                    onChange={(e) =>
                      setNewPort((p) => ({ ...p, protocol: e.target.value }))
                    }
                    className={inputCls + " w-28 cursor-pointer"}
                  >
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={addingPort}
                  className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                >
                  {addingPort ? "…" : "Добавить"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPort(false);
                    setPortError(null);
                  }}
                  className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-600 transition hover:bg-gray-200"
                >
                  Отмена
                </button>
                {portError && (
                  <p className="w-full text-xs text-red-600">{portError}</p>
                )}
              </form>
            )}
            {editingPortId && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="mb-2 text-xs font-semibold text-amber-800">
                  Редактирование маппинга
                </p>
                <form onSubmit={handleUpdatePort} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Порт контейнера
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={editPortForm.container_port}
                      onChange={(e) =>
                        setEditPortForm((p) => ({ ...p, container_port: e.target.value }))
                      }
                      className={inputCls + " w-36"}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Порт хоста
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={editPortForm.host_port}
                      onChange={(e) =>
                        setEditPortForm((p) => ({ ...p, host_port: e.target.value }))
                      }
                      className={inputCls + " w-36"}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Протокол
                    </label>
                    <select
                      value={editPortForm.protocol}
                      onChange={(e) =>
                        setEditPortForm((p) => ({ ...p, protocol: e.target.value }))
                      }
                      className={inputCls + " w-28 cursor-pointer"}
                    >
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700"
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPortId(null)}
                    className="rounded-xl bg-white px-4 py-2.5 text-sm text-gray-600 transition hover:bg-gray-100"
                  >
                    Отмена
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Networks ── */}
        {activeTab === "networks" && (
          <div className="rounded-2xl bg-white px-8 py-6 shadow-2xl ring-1 ring-black/5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Приватные сети</h2>
              <button
                onClick={loadNetworksData}
                className="text-xs font-semibold text-gray-500 hover:text-red-700"
              >
                Обновить
              </button>
            </div>
            {networksError && (
              <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {networksError}
              </div>
            )}
            {networksLoading ? (
              <p className="text-sm text-gray-400">Загрузка сетей…</p>
            ) : (
              <>
                {containerNetworks.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Контейнер не подключён ни к одной сети.
                  </p>
                ) : (
                  <div className="mb-4 grid gap-3 sm:grid-cols-2">
                    {containerNetworks.map((n) => (
                      <div
                        key={n.network_id}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {n.name}
                            </div>
                            <div className="text-xs text-gray-500">{n.subnet}</div>
                            {n.ip_address && (
                              <div className="mt-1 font-mono text-xs text-gray-700">
                                IP: {n.ip_address}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleDetachNetwork(n.network_id)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                          >
                            Отключить
                          </button>
                        </div>
                        {n.description && (
                          <p className="mt-2 text-xs text-gray-500">{n.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Подключить к сети
                  </h3>
                  <form onSubmit={handleAttachNetwork} className="mt-3 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Сеть
                      </label>
                      <select
                        required
                        value={networkForm.network_id}
                        onChange={(e) =>
                          setNetworkForm((f) => ({ ...f, network_id: e.target.value }))
                        }
                        className={inputCls + " w-56 cursor-pointer"}
                      >
                        <option value="">Выберите…</option>
                        {allNetworks
                          .filter((n) => !containerNetworks.find((c) => c.network_id === n.network_id))
                          .map((n) => (
                            <option key={n.network_id} value={n.network_id}>
                              {n.name} · {n.subnet}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        IP (опционально)
                      </label>
                      <input
                        value={networkForm.ip_address}
                        onChange={(e) =>
                          setNetworkForm((f) => ({ ...f, ip_address: e.target.value }))
                        }
                        placeholder="Авто"
                        className={inputCls + " w-48"}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={networkSaving || !networkForm.network_id}
                      className="rounded-xl bg-[#B42124] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                    >
                      {networkSaving ? "Подключение…" : "Подключить"}
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab: Terminal ── */}
        {activeTab === "terminal" && (
          <div className="rounded-2xl bg-white px-8 py-6 shadow-2xl ring-1 ring-black/5">
            <h2 className="mb-4 text-lg font-bold text-gray-900">Терминал</h2>
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
                className="flex-shrink-0 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {cmdRunning ? (
                  <svg
                    className="h-4 w-4 animate-spin"
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
                ) : (
                  "Запустить"
                )}
              </button>
            </form>
            {cmdError && (
              <p className="mt-2 text-xs text-red-600">{cmdError}</p>
            )}
            {cmdOutput !== null && (
              <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-gray-950 p-4 font-mono text-xs text-green-400">
                {cmdOutput || "(нет вывода)"}
              </pre>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
// ── MetricsTab ──────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1e9) return (b / 1e9).toFixed(1) + " GB";
  if (b >= 1e6) return (b / 1e6).toFixed(1) + " MB";
  if (b >= 1e3) return (b / 1e3).toFixed(1) + " KB";
  return b + " B";
}

function MetricCard({
  label,
  value,
  data,
  color,
  fillColor,
  min = 0,
  max,
}: {
  label: string;
  value: string;
  data: number[];
  color: string;
  fillColor?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <span className="text-sm font-bold text-gray-900">{value}</span>
      </div>
      <Sparkline
        data={data}
        height={52}
        color={color}
        fillColor={fillColor}
        min={min}
        max={max}
      />
    </div>
  );
}

function MetricsTab({
  status,
  history,
  connected,
  error,
}: {
  status: ContainerStatus;
  history: MetricsPoint[];
  connected: boolean;
  error: string | null;
}) {
  if (status !== "RUNNING") {
    return (
      <div className="rounded-2xl bg-white px-8 py-12 text-center text-gray-400 shadow-2xl ring-1 ring-black/5">
        <div className="mb-2 text-4xl">⏸</div>
        <p className="text-sm">Контейнер не запущен — метрики недоступны.</p>
      </div>
    );
  }

  const last = history[history.length - 1];

  return (
    <div className="space-y-6 rounded-2xl bg-white px-8 py-6 shadow-2xl ring-1 ring-black/5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">
          Метрики в реальном времени
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${connected ? "animate-pulse bg-green-500" : "bg-gray-300"}`}
          />
          <span className="text-xs text-gray-500">
            {connected ? "Подключено" : "Подключение…"}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {history.length === 0 && !error && (
        <p className="py-8 text-center text-sm text-gray-400">
          Ожидание данных…
        </p>
      )}

      {history.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <MetricCard
            label="CPU %"
            value={`${(last?.cpu_percent ?? 0).toFixed(1)}%`}
            data={history.map((p) => p.cpu_percent)}
            color="#ef4444"
            fillColor="#ef444422"
            min={0}
            max={100}
          />
          <MetricCard
            label="RAM %"
            value={`${(last?.ram_percent ?? 0).toFixed(1)}%`}
            data={history.map((p) => p.ram_percent)}
            color="#8b5cf6"
            fillColor="#8b5cf622"
            min={0}
            max={100}
          />
          <MetricCard
            label="Диск"
            value={fmtBytes(last?.disk_usage_bytes ?? 0)}
            data={history.map((p) => p.disk_usage_bytes)}
            color="#f97316"
            fillColor="#f9731622"
          />
          <MetricCard
            label="Сеть ↓↑"
            value={`${fmtBytes(last?.network_rx_bytes ?? 0)} / ${fmtBytes(last?.network_tx_bytes ?? 0)}`}
            data={history.map((p) => p.network_rx_bytes + p.network_tx_bytes)}
            color="#10b981"
            fillColor="#10b98122"
          />
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  mono,
  small,
}: {
  icon: string;
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500">
        <span>{icon}</span>
        {label}
      </div>
      <p
        className={`truncate font-semibold text-gray-900 ${mono ? "font-mono" : ""} ${small ? "text-xs" : "text-base"}`}
      >
        {value}
      </p>
    </div>
  );
}
