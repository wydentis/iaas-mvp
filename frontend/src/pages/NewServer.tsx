import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPublicNodes, createContainer } from "../api/requests";
import type { Node } from "../api/requests";
import { getCookie } from "../utils/cookies";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";

// ── Pricing (₽/month estimates) ───────────────────────────────────────────────
const CPU_PRICE = 150;
const RAM_PRICE = 80;
const DISK_PRICE = 5;

// ── OS images ─────────────────────────────────────────────────────────────────
const IMAGES = [
  {
    id: "ubuntu:22.04",
    label: "Ubuntu 22.04",
    icon: "🟠",
    desc: "LTS, популярный",
  },
  {
    id: "ubuntu:20.04",
    label: "Ubuntu 20.04",
    icon: "🟠",
    desc: "LTS, стабильный",
  },
  { id: "debian:12", label: "Debian 12", icon: "🔴", desc: "Bookworm" },
  { id: "debian:11", label: "Debian 11", icon: "🔴", desc: "Bullseye" },
  {
    id: "alpine:3.19",
    label: "Alpine 3.19",
    icon: "🔵",
    desc: "Минималистичный",
  },
  { id: "centos:7", label: "CentOS 7", icon: "💜", desc: "Корпоративный" },
  { id: "fedora:39", label: "Fedora 39", icon: "🔵", desc: "Современный" },
  { id: "arch:latest", label: "Arch Linux", icon: "🔷", desc: "Передовой" },
];

const CPU_OPTS = [1, 2, 4, 8, 16];
const RAM_OPTS = [512, 1024, 2048, 4096, 8192, 16384];
const DISK_OPTS = [10, 20, 40, 80, 160, 320];

const PLANS = [
  {
    id: "starter",
    label: "Старт",
    cpu: 1,
    ram: 512,
    disk: 10,
    badge: null,
    badgeColor: "",
  },
  {
    id: "basic",
    label: "Базовый",
    cpu: 1,
    ram: 1024,
    disk: 20,
    badge: null,
    badgeColor: "",
  },
  {
    id: "standard",
    label: "Стандарт",
    cpu: 2,
    ram: 2048,
    disk: 40,
    badge: "Популярный",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "pro",
    label: "Профи",
    cpu: 4,
    ram: 4096,
    disk: 80,
    badge: null,
    badgeColor: "",
  },
  {
    id: "business",
    label: "Бизнес",
    cpu: 8,
    ram: 8192,
    disk: 160,
    badge: null,
    badgeColor: "",
  },
  {
    id: "custom",
    label: "Своя конфиг",
    cpu: 0,
    ram: 0,
    disk: 0,
    badge: "Гибко",
    badgeColor: "bg-amber-100 text-amber-700",
  },
];

function calcPrice(cpu: number, ram: number, disk: number) {
  return (
    cpu * CPU_PRICE + Math.round((ram / 1024) * RAM_PRICE) + disk * DISK_PRICE
  );
}

function formatRAM(mb: number) {
  return mb >= 1024 ? `${mb / 1024} ГБ` : `${mb} МБ`;
}

// ── AI Modal ──────────────────────────────────────────────────────────────────
function AiModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-slide-up w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-4xl">🤖</div>
        <h2 className="mb-2 text-lg font-black text-gray-900">Спросить у ИИ</h2>
        <p className="text-sm leading-relaxed text-gray-500">
          Функция ИИ-ассистента для подбора конфигурации находится в разработке.
          <br />
          <br />
          Скоро вы сможете описать задачу и получить оптимальные рекомендации.
        </p>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}

// ── SelectCard ────────────────────────────────────────────────────────────────
function SelectCard({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative cursor-pointer rounded-xl border p-4 text-left transition ${
        selected
          ? "border-red-700 bg-red-50 shadow-[0_0_0_3px_rgba(153,0,0,0.08)]"
          : "border-gray-200 bg-white hover:border-red-300 hover:bg-red-50/30"
      } ${className}`}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-700 text-[10px] text-white">
          ✓
        </span>
      )}
      {children}
    </button>
  );
}

// ── Step header ───────────────────────────────────────────────────────────────
function StepHeader({
  step,
  title,
  optional,
}: {
  step: string;
  title: string;
  optional?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-red-700 text-xs font-black text-white">
        {step}
      </span>
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      {optional && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-400">
          необязательно
        </span>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NewServer() {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [aiOpen, setAiOpen] = useState(false);

  const [name, setName] = useState("");
  const [planId, setPlanId] = useState("standard");
  const [image, setImage] = useState("ubuntu:22.04");
  const [nodeId, setNodeId] = useState("");
  const [cpu, setCpu] = useState(2);
  const [ram, setRam] = useState(2048);
  const [disk, setDisk] = useState(40);
  const [script, setScript] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getCookie("access_token")) { navigate("/"); return; }
    listPublicNodes()
      .then((n) => { const a = n ?? []; setNodes(a); if (a.length > 0) setNodeId(a[0].node_id); })
      .catch(() => setNodes([]));
  }, [navigate]);

  function selectPlan(id: string) {
    setPlanId(id);
    const p = PLANS.find((x) => x.id === id)!;
    if (id !== "custom" && p.cpu > 0) {
      setCpu(p.cpu);
      setRam(p.ram);
      setDisk(p.disk);
    }
  }

  function pickCpu(c: number) {
    setCpu(c);
    setPlanId("custom");
  }
  function pickRam(r: number) {
    setRam(r);
    setPlanId("custom");
  }
  function pickDisk(d: number) {
    setDisk(d);
    setPlanId("custom");
  }

  const price = calcPrice(cpu, ram, disk);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Введите название сервера");
      return;
    }
    if (!nodeId) {
      setError("Выберите регион");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      const c = await createContainer({
        name: name.trim(),
        node_id: nodeId,
        image,
        cpu,
        ram,
        disk,
        start_script: script,
      });
      navigate(`/servers/${c.container_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания");
      setCreating(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 placeholder:text-gray-400";

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      {aiOpen && <AiModal onClose={() => setAiOpen(false)} />}

      {/* ── Top bar (outside white panel, over animation) ── */}
      <div className="relative z-10">
        <Header />
      </div>

      {/* ── White panel wrapper ── */}
      <div className="relative z-10 mx-auto max-w-[1400px] px-4 pt-6 pb-16">
        {/* Panel top bar — back button only */}
        <div className="mb-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30"
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
            Назад
          </button>
        </div>

        {/* ── Main white card ── */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Card title bar */}
          <div className="flex items-center gap-3 border-b border-gray-100 px-8 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-700">
              <svg
                className="h-5 w-5 text-white"
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
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900">
                Создать сервер
              </h1>
              <p className="text-xs text-gray-400">
                Выберите конфигурацию и запустите контейнер
              </p>
            </div>
          </div>

          {/* ── Ask AI — full-width button inside the panel ── */}
          <div className="px-6 py-4 border-b border-gray-100">
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="group flex w-full items-center justify-center gap-3 rounded-xl bg-red-700 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-600 active:bg-red-800"
            >
              <span className="text-lg">🤖</span>
              Спросить у ИИ — получить рекомендацию по конфигурации
              <svg className="ml-auto h-4 w-4 text-red-200 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleCreate}>
            {/* LEFT — full width (right panel is fixed, not in flow) */}
            <div className="min-h-[600px] space-y-10 px-8 py-8"
                 style={{ marginRight: "308px" }}>
                {/* 1. Название */}
                <section>
                  <StepHeader step="1" title="Название сервера" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="my-web-server"
                    className={inputCls + " max-w-sm"}
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    Латинские буквы, цифры и дефисы
                  </p>
                </section>

                {/* 2. Тарифный план */}
                <section>
                  <StepHeader step="2" title="Тарифный план" />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                    {PLANS.map((p) => {
                      const pp =
                        p.id !== "custom"
                          ? calcPrice(p.cpu, p.ram, p.disk)
                          : null;
                      return (
                        <SelectCard
                          key={p.id}
                          selected={planId === p.id}
                          onClick={() => selectPlan(p.id)}
                        >
                          {p.badge && (
                            <span
                              className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${p.badgeColor}`}
                            >
                              {p.badge}
                            </span>
                          )}
                          <div className="text-sm font-bold text-gray-900">
                            {p.label}
                          </div>
                          {p.id !== "custom" ? (
                            <>
                              <div className="mt-1 text-[11px] text-gray-400">
                                {p.cpu} CPU · {formatRAM(p.ram)}
                              </div>
                              <div className="text-[11px] text-gray-400">
                                {p.disk} ГБ SSD
                              </div>
                              <div className="mt-1.5 text-sm font-bold text-red-700">
                                {pp} ₽/мес
                              </div>
                            </>
                          ) : (
                            <div className="mt-1 text-xs text-gray-400">
                              Настрой сам
                            </div>
                          )}
                        </SelectCard>
                      );
                    })}
                  </div>
                </section>

                {/* 3. ОС */}
                <section>
                  <StepHeader step="3" title="Операционная система" />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {IMAGES.map((img) => (
                      <SelectCard
                        key={img.id}
                        selected={image === img.id}
                        onClick={() => setImage(img.id)}
                      >
                        <div className="mb-2 text-2xl">{img.icon}</div>
                        <div className="text-sm font-bold text-gray-900">
                          {img.label}
                        </div>
                        <div className="mt-0.5 text-xs text-gray-400">
                          {img.desc}
                        </div>
                      </SelectCard>
                    ))}
                  </div>
                </section>

                {/* 4. Регион */}
                <section>
                  <StepHeader step="4" title="Регион / Узел" />
                  {nodes.length === 0 ? (
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-400">
                      Нет доступных узлов
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {nodes.map((n) => (
                        <SelectCard
                          key={n.node_id}
                          selected={nodeId === n.node_id}
                          onClick={() => setNodeId(n.node_id)}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-gray-900">
                                {n.name}
                              </div>
                              <div className="mt-0.5 font-mono text-xs text-gray-400">
                                {n.ip_address}
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                n.status === "online"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {n.status}
                            </span>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-500">
                              ⚙️ {n.cpu_cores} CPU
                            </span>
                            <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs text-gray-500">
                              🧠 {formatRAM(n.ram)}
                            </span>
                          </div>
                        </SelectCard>
                      ))}
                    </div>
                  )}
                </section>

                {/* 5. CPU */}
                <section>
                  <StepHeader step="5" title="Процессоры" />
                  <div className="flex flex-wrap gap-3">
                    {CPU_OPTS.map((c) => (
                      <SelectCard
                        key={c}
                        selected={cpu === c}
                        onClick={() => pickCpu(c)}
                        className="w-24 text-center"
                      >
                        <div className="text-xl">⚙️</div>
                        <div className="mt-1 text-sm font-bold text-gray-900">
                          {c} {c === 1 ? "ядро" : c < 5 ? "ядра" : "ядер"}
                        </div>
                        <div className="mt-0.5 text-[10px] text-gray-400">
                          +{c * CPU_PRICE} ₽
                        </div>
                      </SelectCard>
                    ))}
                  </div>
                </section>

                {/* 6. RAM */}
                <section>
                  <StepHeader step="6" title="Оперативная память" />
                  <div className="flex flex-wrap gap-3">
                    {RAM_OPTS.map((r) => (
                      <SelectCard
                        key={r}
                        selected={ram === r}
                        onClick={() => pickRam(r)}
                        className="w-28 text-center"
                      >
                        <div className="text-xl">🧠</div>
                        <div className="mt-1 text-sm font-bold text-gray-900">
                          {formatRAM(r)}
                        </div>
                        <div className="mt-0.5 text-[10px] text-gray-400">
                          +{Math.round((r / 1024) * RAM_PRICE)} ₽
                        </div>
                      </SelectCard>
                    ))}
                  </div>
                </section>

                {/* 7. Disk */}
                <section>
                  <StepHeader step="7" title="Диск SSD" />
                  <div className="flex flex-wrap gap-3">
                    {DISK_OPTS.map((d) => (
                      <SelectCard
                        key={d}
                        selected={disk === d}
                        onClick={() => pickDisk(d)}
                        className="w-28 text-center"
                      >
                        <div className="text-xl">💾</div>
                        <div className="mt-1 text-sm font-bold text-gray-900">
                          {d} ГБ
                        </div>
                        <div className="mt-0.5 text-[10px] text-gray-400">
                          +{d * DISK_PRICE} ₽
                        </div>
                      </SelectCard>
                    ))}
                  </div>
                </section>

                {/* 8. Скрипт */}
                <section>
                  <StepHeader step="8" title="Скрипт запуска" optional />
                  <textarea
                    rows={5}
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder={
                      "#!/bin/bash\napt update && apt install -y nginx"
                    }
                    className={inputCls + " resize-none font-mono text-xs"}
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    Выполняется один раз при первом запуске контейнера
                  </p>
                </section>
            </div>
          </form>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          FIXED SUMMARY PANEL — always visible
      ════════════════════════════════════════════ */}
      <div className="fixed right-4 top-20 bottom-4 z-20 flex w-[292px] flex-col overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="space-y-5 p-6">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">Итог</h2>

                  {/* Config summary */}
                  <div className="space-y-2.5">
                    <SummaryRow
                      icon="🖥️"
                      label="Название"
                      value={
                        name || (
                          <span className="text-gray-300 italic">
                            не задано
                          </span>
                        )
                      }
                    />
                    <SummaryRow
                      icon="🐧"
                      label="ОС"
                      value={IMAGES.find((i) => i.id === image)?.label ?? image}
                    />
                    <SummaryRow
                      icon="📍"
                      label="Регион"
                      value={
                        nodes.find((n) => n.node_id === nodeId)?.name ?? (
                          <span className="text-gray-300 italic">
                            не выбран
                          </span>
                        )
                      }
                    />
                    <SummaryRow
                      icon="⚙️"
                      label="CPU"
                      value={`${cpu} ${cpu === 1 ? "ядро" : cpu < 5 ? "ядра" : "ядер"}`}
                    />
                    <SummaryRow icon="🧠" label="RAM" value={formatRAM(ram)} />
                    <SummaryRow
                      icon="💾"
                      label="Диск"
                      value={`${disk} ГБ SSD`}
                    />
                  </div>

                  <div className="border-t border-gray-200" />

                  {/* Pricing */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>
                        CPU ({cpu} × {CPU_PRICE} ₽)
                      </span>
                      <span>{cpu * CPU_PRICE} ₽</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>
                        RAM ({formatRAM(ram)} × {RAM_PRICE} ₽/ГБ)
                      </span>
                      <span>{Math.round((ram / 1024) * RAM_PRICE)} ₽</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>
                        SSD ({disk} × {DISK_PRICE} ₽)
                      </span>
                      <span>{disk * DISK_PRICE} ₽</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
                      <span>Итого / месяц</span>
                      <span className="text-red-700">{price} ₽</span>
                    </div>
                    <p className="text-[10px] text-gray-300">
                      Примерная стоимость. Списывается посуточно.
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700 ring-1 ring-red-100">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={creating || nodes.length === 0 || !name.trim()}
                    className="group relative w-full overflow-hidden rounded-xl bg-red-900 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-white/10 transition-transform duration-500 group-hover:translate-x-[200%]" />
                    <span className="relative flex items-center justify-center gap-2">
                      {creating ? (
                        <>
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
                          Создание…
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4"
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
                          Создать сервер
                        </>
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/dashboard")}
                    className="w-full rounded-xl border border-gray-200 py-2.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                  >
                    Отмена
                  </button>
                </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-gray-400">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <span className="max-w-[55%] truncate text-right text-xs font-semibold text-gray-700">
        {value}
      </span>
    </div>
  );
}
