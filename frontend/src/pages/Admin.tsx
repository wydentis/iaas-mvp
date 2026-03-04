import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  adminListUsers,
  adminListContainers,
  adminListNodes,
  adminCreateNode,
  adminUpdateNode,
  adminDeleteNode,
  getUserInfo,
} from "../api/requests";
import type {
  AdminUser,
  Container,
  Node,
  CreateNodePayload,
} from "../api/requests";
import { getCookie } from "../utils/cookies";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "overview" | "tenants" | "containers" | "nodes";

interface TenantLimits {
  max_cpu: number;
  max_ram: number;
  max_disk: number;
  max_vps: number;
}

const DEFAULT_LIMITS: TenantLimits = {
  max_cpu: 0,
  max_ram: 0,
  max_disk: 0,
  max_vps: 0,
};

function getLimits(userId: string): TenantLimits {
  try {
    const s = localStorage.getItem(`tlimits_${userId}`);
    return s ? { ...DEFAULT_LIMITS, ...JSON.parse(s) } : { ...DEFAULT_LIMITS };
  } catch {
    return { ...DEFAULT_LIMITS };
  }
}
function saveLimits(userId: string, limits: TenantLimits) {
  localStorage.setItem(`tlimits_${userId}`, JSON.stringify(limits));
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatRAM(mb: number) {
  return mb >= 1024
    ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} ГБ`
    : `${mb} МБ`;
}

function pct(used: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Обзор", icon: "📊" },
  { key: "tenants", label: "Арендаторы", icon: "👥" },
  { key: "containers", label: "Серверы", icon: "🖥️" },
  { key: "nodes", label: "Ноды", icon: "🔧" },
];

const emptyNode: CreateNodePayload = {
  name: "",
  ip_address: "",
  status: "active",
  cpu_cores: 4,
  ram: 8192,
  disk_space: 100,
};

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 placeholder:text-gray-400";

// ── Component ──────────────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Nodes CRUD
  const [showNodeForm, setShowNodeForm] = useState(false);
  const [nodeForm, setNodeForm] = useState<CreateNodePayload>(emptyNode);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [savingNode, setSavingNode] = useState(false);
  const [nodeFormError, setNodeFormError] = useState<string | null>(null);

  // Tenant limits modal
  const [limitsUser, setLimitsUser] = useState<AdminUser | null>(null);
  const [limitsForm, setLimitsForm] = useState<TenantLimits>({
    ...DEFAULT_LIMITS,
  });

  // Tenants search
  const [tenantSearch, setTenantSearch] = useState("");

  // Auth + role guard
  useEffect(() => {
    if (!getCookie("access_token")) {
      navigate("/");
      return;
    }
    getUserInfo()
      .then((u) => {
        if (u.role !== "admin") navigate("/dashboard");
      })
      .catch(() => navigate("/"));
    loadAll();
  }, [navigate]);

  async function loadAll() {
    setLoadingAll(true);
    setLoadError(null);
    try {
      const [u, c, n] = await Promise.all([
        adminListUsers(),
        adminListContainers(),
        adminListNodes(),
      ]);
      setUsers(u);
      setContainers(c);
      setNodes(n);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoadingAll(false);
    }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalCpu = nodes.reduce((s, n) => s + n.cpu_cores, 0);
  const totalRam = nodes.reduce((s, n) => s + n.ram, 0);
  const totalDisk = nodes.reduce((s, n) => s + n.disk_space, 0);
  const usedCpu = containers.reduce((s, c) => s + c.cpu, 0);
  const usedRam = containers.reduce((s, c) => s + c.ram, 0);
  const usedDisk = containers.reduce((s, c) => s + c.disk, 0);
  const runningVMs = containers.filter((c) => c.status === "RUNNING").length;

  // Per-user usage
  const userUsage = useMemo(() => {
    const map: Record<
      string,
      { cpu: number; ram: number; disk: number; vps: number }
    > = {};
    for (const c of containers) {
      if (!map[c.user_id]) map[c.user_id] = { cpu: 0, ram: 0, disk: 0, vps: 0 };
      map[c.user_id].cpu += c.cpu;
      map[c.user_id].ram += c.ram;
      map[c.user_id].disk += c.disk;
      map[c.user_id].vps += 1;
    }
    return map;
  }, [containers]);

  const filteredTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q),
    );
  }, [users, tenantSearch]);

  // ── Nodes CRUD ─────────────────────────────────────────────────────────────
  async function handleNodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNodeFormError(null);
    setSavingNode(true);
    try {
      if (editingNodeId) {
        const updated = await adminUpdateNode(editingNodeId, nodeForm);
        setNodes((prev) =>
          prev.map((n) => (n.node_id === editingNodeId ? updated : n)),
        );
      } else {
        const created = await adminCreateNode(nodeForm);
        setNodes((prev) => [...prev, created]);
      }
      cancelNodeForm();
    } catch (e) {
      setNodeFormError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setSavingNode(false);
    }
  }

  async function handleDeleteNode(id: string) {
    if (!confirm("Удалить ноду?")) return;
    try {
      await adminDeleteNode(id);
      setNodes((prev) => prev.filter((n) => n.node_id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    }
  }

  function startEditNode(node: Node) {
    setEditingNodeId(node.node_id);
    setNodeForm({
      name: node.name,
      ip_address: node.ip_address,
      status: node.status,
      cpu_cores: node.cpu_cores,
      ram: node.ram,
      disk_space: node.disk_space,
    });
    setShowNodeForm(true);
    setNodeFormError(null);
  }

  function cancelNodeForm() {
    setShowNodeForm(false);
    setEditingNodeId(null);
    setNodeForm(emptyNode);
    setNodeFormError(null);
  }

  // ── Limits modal ───────────────────────────────────────────────────────────
  function openLimits(user: AdminUser) {
    setLimitsUser(user);
    setLimitsForm(getLimits(user.user_id));
  }

  function saveLimitsModal() {
    if (!limitsUser) return;
    saveLimits(limitsUser.user_id, limitsForm);
    setLimitsUser(null);
  }

  if (loadingAll)
    return (
      <div className="relative min-h-screen">
        <AnimatedBackground />
        <Header />
        <div className="flex h-[60vh] items-center justify-center">
          <svg
            className="h-8 w-8 animate-spin text-red-400"
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

  if (loadError)
    return (
      <div className="relative min-h-screen">
        <AnimatedBackground />
        <Header />
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <p className="text-red-600">{loadError}</p>
          <button
            onClick={loadAll}
            className="rounded-xl bg-red-700 px-5 py-2 text-sm text-white hover:bg-red-600"
          >
            Повторить
          </button>
        </div>
      </div>
    );

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />

      {/* ── Limits modal ── */}
      {limitsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/10">
            <h2 className="mb-1 text-xl font-black text-gray-900">
              Лимиты арендатора
            </h2>
            <p className="mb-6 text-sm text-gray-500">
              <span className="font-semibold text-gray-700">
                {limitsUser.username}
              </span>{" "}
              · {limitsUser.email}
            </p>
            <p className="mb-4 text-xs text-gray-400">
              Введите 0 для неограниченного значения
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Макс. CPU (ядра)
                </label>
                <input
                  type="number"
                  min={0}
                  value={limitsForm.max_cpu}
                  onChange={(e) =>
                    setLimitsForm((p) => ({
                      ...p,
                      max_cpu: Number(e.target.value),
                    }))
                  }
                  className={inputCls}
                  placeholder="0 = без лимита"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Макс. RAM (МБ)
                </label>
                <input
                  type="number"
                  min={0}
                  value={limitsForm.max_ram}
                  onChange={(e) =>
                    setLimitsForm((p) => ({
                      ...p,
                      max_ram: Number(e.target.value),
                    }))
                  }
                  className={inputCls}
                  placeholder="0 = без лимита"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Макс. Диск (ГБ)
                </label>
                <input
                  type="number"
                  min={0}
                  value={limitsForm.max_disk}
                  onChange={(e) =>
                    setLimitsForm((p) => ({
                      ...p,
                      max_disk: Number(e.target.value),
                    }))
                  }
                  className={inputCls}
                  placeholder="0 = без лимита"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Макс. VPS
                </label>
                <input
                  type="number"
                  min={0}
                  value={limitsForm.max_vps}
                  onChange={(e) =>
                    setLimitsForm((p) => ({
                      ...p,
                      max_vps: Number(e.target.value),
                    }))
                  }
                  className={inputCls}
                  placeholder="0 = без лимита"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={saveLimitsModal}
                className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-bold text-white transition hover:bg-red-800"
              >
                Сохранить
              </button>
              <button
                onClick={() => setLimitsUser(null)}
                className="rounded-xl bg-gray-100 px-5 py-3 text-sm text-gray-600 transition hover:bg-gray-200"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Title + refresh */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              Панель администратора
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Управление инфраструктурой и арендаторами
            </p>
          </div>
          <button
            onClick={loadAll}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Обновить
          </button>
        </div>

        {/* Tab bar */}
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
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ══ TAB: OVERVIEW ══ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Ноды"
                value={String(nodes.length)}
                icon="🔧"
                sub="физических серверов"
              />
              <StatCard
                label="Арендаторы"
                value={String(users.length)}
                icon="👥"
                sub="зарегистрировано"
              />
              <StatCard
                label="VPS всего"
                value={String(containers.length)}
                icon="🖥️"
                sub={`${runningVMs} запущено`}
                subColor="text-emerald-600"
              />
              <StatCard
                label="Активных"
                value={String(runningVMs)}
                icon="✅"
                sub={`из ${containers.length} серверов`}
                subColor="text-emerald-600"
              />
            </div>

            {/* Resource utilisation */}
            <div className="rounded-2xl bg-white px-8 py-6 shadow-2xl ring-1 ring-black/5">
              <h2 className="mb-5 font-bold text-gray-900">
                Использование ресурсов
              </h2>
              <div className="space-y-5">
                <UsageBar
                  label="CPU"
                  used={usedCpu}
                  total={totalCpu}
                  unit="ядер"
                />
                <UsageBar
                  label="RAM"
                  used={usedRam}
                  total={totalRam}
                  unit="МБ"
                  fmt={formatRAM}
                />
                <UsageBar
                  label="Диск"
                  used={usedDisk}
                  total={totalDisk}
                  unit="ГБ"
                  fmt={(v) => `${v} ГБ`}
                />
              </div>
            </div>

            {/* Nodes breakdown */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="font-bold text-gray-900">Ноды инфраструктуры</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Нода
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        IP
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        CPU
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        RAM
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Диск
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Серверов
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                        Статус
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map((n) => {
                      const nodeContainers = containers.filter(
                        (c) => c.node_id === n.node_id,
                      );
                      return (
                        <tr
                          key={n.node_id}
                          className="border-b border-gray-50 transition last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-5 py-3 font-semibold text-gray-900">
                            {n.name}
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-gray-500">
                            {n.ip_address}
                          </td>
                          <td className="px-5 py-3 text-gray-700">
                            {n.cpu_cores} ядер
                          </td>
                          <td className="px-5 py-3 text-gray-700">
                            {formatRAM(n.ram)}
                          </td>
                          <td className="px-5 py-3 text-gray-700">
                            {n.disk_space} ГБ
                          </td>
                          <td className="px-5 py-3">
                            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                              {nodeContainers.length}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                              {n.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {nodes.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-8 text-center text-sm text-gray-400"
                        >
                          Ноды не найдены
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: TENANTS ══ */}
        {activeTab === "tenants" && (
          <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-bold text-gray-900">Арендаторы</h2>
              <div className="relative w-full sm:w-64">
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
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                  placeholder="Поиск по имени или email…"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pr-4 pl-9 text-sm transition outline-none focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Арендатор
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      VPS
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      CPU
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      RAM
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Диск
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Баланс
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Роль
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500" />
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.map((u) => {
                    const usage = userUsage[u.user_id] ?? {
                      cpu: 0,
                      ram: 0,
                      disk: 0,
                      vps: 0,
                    };
                    const limits = getLimits(u.user_id);
                    const overCpu =
                      limits.max_cpu > 0 && usage.cpu > limits.max_cpu;
                    const overRam =
                      limits.max_ram > 0 && usage.ram > limits.max_ram;
                    const overDisk =
                      limits.max_disk > 0 && usage.disk > limits.max_disk;
                    const overVps =
                      limits.max_vps > 0 && usage.vps > limits.max_vps;
                    const overLimit = overCpu || overRam || overDisk || overVps;
                    return (
                      <tr
                        key={u.user_id}
                        className={`border-b border-gray-50 transition last:border-0 ${overLimit ? "bg-red-50/50" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            {overLimit && (
                              <span
                                title="Превышен лимит"
                                className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 break-words">
                                {u.username}
                              </div>
                              <div className="text-xs text-gray-400 break-words">
                                {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <LimitCell
                            used={usage.vps}
                            max={limits.max_vps}
                            over={overVps}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <LimitCell
                            used={usage.cpu}
                            max={limits.max_cpu}
                            over={overCpu}
                            suffix="ядер"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <LimitCell
                            used={usage.ram}
                            max={limits.max_ram}
                            over={overRam}
                            fmt={formatRAM}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <LimitCell
                            used={usage.disk}
                            max={limits.max_disk}
                            over={overDisk}
                            suffix="ГБ"
                          />
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-700">
                          {u.balance.toLocaleString()} BYN
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.role === "admin" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-600"}`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => openLimits(u)}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            Лимиты
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTenants.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-5 py-8 text-center text-sm text-gray-400"
                      >
                        Арендаторы не найдены
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TAB: CONTAINERS ══ */}
        {activeTab === "containers" && (
          <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="font-bold text-gray-900">Все серверы</h2>
                <p className="text-xs text-gray-400">
                  {containers.length} контейнеров · {runningVMs} запущено
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Сервер
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Арендатор
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Образ
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Ресурсы
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      IP
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {containers.map((c) => {
                    const owner = users.find((u) => u.user_id === c.user_id);
                    return (
                      <tr
                        key={c.container_id}
                        className="border-b border-gray-50 transition last:border-0 hover:bg-gray-50"
                      >
                        <td className="px-5 py-3">
                          <div className="font-semibold text-gray-900 break-words">
                            {c.name}
                          </div>
                          <div className="font-mono text-xs text-gray-400 break-words">
                            {c.container_id.slice(0, 12)}…
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-600 break-words">
                          {owner?.username ?? c.user_id.slice(0, 8)}
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-600 break-words">
                          {c.image}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-600">
                          {c.cpu} CPU · {formatRAM(c.ram)} · {c.disk} ГБ
                        </td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-600">
                          {c.ip_address || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={c.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {containers.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-8 text-center text-sm text-gray-400"
                      >
                        Серверы не найдены
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TAB: NODES ══ */}
        {activeTab === "nodes" && (
          <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-bold text-gray-900">Ноды</h2>
              {!showNodeForm && (
                <button
                  onClick={() => {
                    setShowNodeForm(true);
                    setEditingNodeId(null);
                    setNodeForm(emptyNode);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-red-700 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-800"
                >
                  <svg
                    className="h-3.5 w-3.5"
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
                  Добавить ноду
                </button>
              )}
            </div>

            {showNodeForm && (
              <div className="border-b border-gray-100 bg-gray-50 px-6 py-5">
                <h3 className="mb-4 text-sm font-bold text-gray-700">
                  {editingNodeId ? "Редактировать ноду" : "Новая нода"}
                </h3>
                <form
                  onSubmit={handleNodeSubmit}
                  className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                >
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Имя *
                    </label>
                    <input
                      required
                      value={nodeForm.name}
                      onChange={(e) =>
                        setNodeForm((p) => ({ ...p, name: e.target.value }))
                      }
                      className={inputCls}
                      placeholder="node-01"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      IP-адрес *
                    </label>
                    <input
                      required
                      value={nodeForm.ip_address}
                      onChange={(e) =>
                        setNodeForm((p) => ({
                          ...p,
                          ip_address: e.target.value,
                        }))
                      }
                      className={inputCls}
                      placeholder="192.168.1.1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Статус *
                    </label>
                    <input
                      required
                      value={nodeForm.status}
                      onChange={(e) =>
                        setNodeForm((p) => ({ ...p, status: e.target.value }))
                      }
                      className={inputCls}
                      placeholder="active"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      CPU ядер
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={nodeForm.cpu_cores}
                      onChange={(e) =>
                        setNodeForm((p) => ({
                          ...p,
                          cpu_cores: Number(e.target.value),
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      RAM (МБ)
                    </label>
                    <input
                      type="number"
                      min={512}
                      value={nodeForm.ram}
                      onChange={(e) =>
                        setNodeForm((p) => ({
                          ...p,
                          ram: Number(e.target.value),
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Диск (ГБ)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={nodeForm.disk_space}
                      onChange={(e) =>
                        setNodeForm((p) => ({
                          ...p,
                          disk_space: Number(e.target.value),
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  {nodeFormError && (
                    <p className="col-span-full text-xs text-red-600">
                      {nodeFormError}
                    </p>
                  )}
                  <div className="col-span-full flex gap-2">
                    <button
                      type="submit"
                      disabled={savingNode}
                      className="rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                    >
                      {savingNode
                        ? "…"
                        : editingNodeId
                          ? "Сохранить"
                          : "Создать"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelNodeForm}
                      className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm text-gray-600 transition hover:bg-gray-200"
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Имя
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      IP
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Ресурсы
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Серверов
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                      Статус
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500" />
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((n) => (
                    <tr
                      key={n.node_id}
                      className="border-b border-gray-50 transition last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-5 py-3 font-semibold text-gray-900 break-words">
                        {n.name}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-gray-500 break-words">
                        {n.ip_address}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-600 break-words">
                        {n.cpu_cores} CPU · {formatRAM(n.ram)} · {n.disk_space}{" "}
                        ГБ
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                          {
                            containers.filter((c) => c.node_id === n.node_id)
                              .length
                          }
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                          {n.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => startEditNode(n)}
                            className="text-xs text-gray-400 transition hover:text-gray-700"
                          >
                            Изменить
                          </button>
                          <button
                            onClick={() => handleDeleteNode(n.node_id)}
                            className="text-xs text-gray-400 transition hover:text-red-600"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {nodes.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-8 text-center text-sm text-gray-400"
                      >
                        Ноды не найдены
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  sub,
  subColor = "text-gray-400",
}: {
  label: string;
  value: string;
  icon: string;
  sub: string;
  subColor?: string;
}) {
  return (
    <div className="rounded-2xl bg-white px-6 py-5 shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-black text-gray-900">{value}</span>
      </div>
      <div className="mt-3">
        <div className="text-sm font-semibold text-gray-700">{label}</div>
        <div className={`text-xs ${subColor}`}>{sub}</div>
      </div>
    </div>
  );
}

function UsageBar({
  label,
  used,
  total,
  unit,
  fmt,
}: {
  label: string;
  used: number;
  total: number;
  unit: string;
  fmt?: (v: number) => string;
}) {
  const p = pct(used, total);
  const display = fmt
    ? `${fmt(used)} / ${fmt(total)}`
    : `${used} / ${total} ${unit}`;
  const color =
    p > 85 ? "bg-red-500" : p > 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-500">
          {display} ·{" "}
          <span
            className={`font-semibold ${p > 85 ? "text-red-600" : p > 60 ? "text-amber-600" : "text-emerald-600"}`}
          >
            {p}%
          </span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

function LimitCell({
  used,
  max,
  over,
  suffix,
  fmt,
}: {
  used: number;
  max: number;
  over: boolean;
  suffix?: string;
  fmt?: (v: number) => string;
}) {
  const display = fmt ? fmt(used) : `${used}${suffix ? " " + suffix : ""}`;
  const limit =
    max > 0 ? (fmt ? fmt(max) : `${max}${suffix ? " " + suffix : ""}`) : "∞";
  return (
    <span
      className={`font-mono text-xs ${over ? "font-bold text-red-600" : "text-gray-700"}`}
    >
      {display} <span className="text-gray-400">/ {limit}</span>
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    RUNNING: "bg-emerald-50 text-emerald-700",
    STOPPED: "bg-gray-100 text-gray-600",
    PENDING: "bg-amber-50 text-amber-700",
    ERROR: "bg-red-50 text-red-700",
    UNKNOWN: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status] ?? styles.UNKNOWN}`}
    >
      {status}
    </span>
  );
}
