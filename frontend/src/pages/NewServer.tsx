import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listPublicNodes,
  createContainer,
  listNetworks,
  attachContainerToNetwork,
  getHardwareRecommendation,
} from "../api/requests";
import type { Node, Network, HardwareRecommendation } from "../api/requests";
import { getCookie } from "../utils/cookies";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";



// ── Pricing defaults (BYN/month, used when node has no pricing data) ──────────
const DEFAULT_CPU_PRICE = 14;
const DEFAULT_RAM_PRICE = 9;
const DEFAULT_DISK_PRICE = 0.6;
const TEMPORARY_NODE: Node = {
  node_id: "temp-node-1",
  name: "Локальный узел (Демо)",
  ip_address: "127.0.0.1",
  status: "online",
  cpu_price: DEFAULT_CPU_PRICE,
  ram_price: DEFAULT_RAM_PRICE,
  disk_price: DEFAULT_DISK_PRICE,
};

// ── OS images ─────────────────────────────────────────────────────────────────
const IMAGES = [
  { id: "ubuntu/22.04", label: "Ubuntu 22.04", logo: "/os-logos/ubuntu.png", desc: "LTS, популярный" },
  { id: "ubuntu/20.04", label: "Ubuntu 20.04", logo: "/os-logos/ubuntu.png", desc: "LTS, стабильный" },
  { id: "debian/12", label: "Debian 12", logo: "/os-logos/debian.png", desc: "Bookworm" },
  { id: "debian/11", label: "Debian 11", logo: "/os-logos/debian.png", desc: "Bullseye" },
  { id: "alpine/3.19", label: "Alpine 3.19", logo: "/os-logos/alpine.png", desc: "Минималистичный" },
  { id: "centos/7", label: "CentOS 7", logo: "/os-logos/centos.png", desc: "Корпоративный" },
  { id: "fedora/39", label: "Fedora 39", logo: "/os-logos/fedora.png", desc: "Современный" },
  { id: "arch/latest", label: "Arch Linux", logo: "/os-logos/arch.png", desc: "i use arch btw" },
];

const PLANS = [
  { id: "starter", label: "Старт", cpu: 1, ram: 512, disk: 10, badge: null, badgeColor: "" },
  { id: "basic", label: "Базовый", cpu: 1, ram: 1024, disk: 20, badge: null, badgeColor: "" },
  { id: "standard", label: "Стандарт", cpu: 2, ram: 2048, disk: 40, badge: "Популярный", badgeColor: "bg-emerald-100 text-emerald-700" },
  { id: "pro", label: "Профи", cpu: 4, ram: 4096, disk: 80, badge: null, badgeColor: "" },
  { id: "business", label: "Бизнес", cpu: 8, ram: 8192, disk: 160, badge: null, badgeColor: "" },
  { id: "custom", label: "Кастом", cpu: 0, ram: 0, disk: 0, badge: "Гибко", badgeColor: "bg-amber-100 text-amber-700" },
];

function calcPrice(cpu: number, ram: number, disk: number, cpuP: number, ramP: number, diskP: number) {
  return Number((cpu * cpuP + Math.round((ram / 1024) * ramP) + disk * diskP).toFixed(1));
}

function formatBYN(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

function formatRAM(mb: number) {
  return mb >= 1024 ? `${mb / 1024} ГБ` : `${mb} МБ`;
}

function getSshScriptPlaceholder(imageId: string) {
  if (imageId.startsWith("alpine/")) {
    return "#!/bin/sh\napk add --no-cache openssh\nrc-update add sshd default\nservice sshd start";
  }
  if (imageId.startsWith("centos/")) {
    return "#!/bin/bash\nyum install -y openssh-server\nsystemctl enable --now sshd";
  }
  if (imageId.startsWith("fedora/")) {
    return "#!/bin/bash\ndnf install -y openssh-server\nsystemctl enable --now sshd";
  }
  if (imageId.startsWith("arch/")) {
    return "#!/bin/bash\npacman -Sy --noconfirm openssh\nsystemctl enable --now sshd";
  }
  return "#!/bin/bash\napt update && apt install -y openssh-server\nsystemctl enable --now ssh";
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
function StepHeader({ step, title, optional }: { step: string; title: string; optional?: boolean }) {
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

// ── Slider Configuration Component ────────────────────────────────────────────
function ConfigSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  icon,
  priceLabel,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string | ((val: number) => string);
  icon: string;
  priceLabel: string;
  onChange: (val: number) => void;
}) {
  const displayUnit = typeof unit === "function" ? unit(value) : `${value} ${unit}`;
  
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-50">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-bold text-gray-900">{label}</span>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-red-700">{displayUnit}</div>
          <div className="text-[11px] text-gray-400">{priceLabel}</div>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-red-700 outline-none"
      />
      <div className="mt-2 flex justify-between text-[10px] font-medium text-gray-400">
        <span>{typeof unit === "function" ? unit(min) : `${min} ${unit}`}</span>
        <span>{typeof unit === "function" ? unit(max) : `${max} ${unit}`}</span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function NewServer() {
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);

  const [name, setName] = useState("");
  const [planId, setPlanId] = useState("standard");
  const [image, setImage] = useState("ubuntu/22.04");
  const [nodeId, setNodeId] = useState("");
  
  // Custom config states
  const [cpu, setCpu] = useState(2);
  const [ram, setRam] = useState(2048);
  const [disk, setDisk] = useState(40);
  const [script, setScript] = useState("");

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requirements, setRequirements] = useState("");
  const [rec, setRec] = useState<HardwareRecommendation | null>(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  useEffect(() => {
    if (!getCookie("access_token")) {
      navigate("/");
      return;
    }
    Promise.all([listPublicNodes(), listNetworks()])
      .then(([n, nets]) => {
        const a = n ?? [];
        setNodes(a);
        if (a.length > 0) setNodeId(a[0].node_id);
        setNetworks(nets ?? []);
      })
      .catch(() => {
        setNodes([TEMPORARY_NODE]); // TODO: DELETE
        setNetworks([]);
      });
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

  function handleCustomChange(setter: (val: number) => void) {
    return (val: number) => {
      setter(val);
      setPlanId("custom");
    };
  }

  function toggleNetwork(id: string) {
    setSelectedNetworks((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    );
  }

  const selectedNode = nodes.find((n) => n.node_id === nodeId);
  const cpuPrice = selectedNode?.cpu_price ?? DEFAULT_CPU_PRICE;
  const ramPrice = selectedNode?.ram_price ?? DEFAULT_RAM_PRICE;
  const diskPrice = selectedNode?.disk_price ?? DEFAULT_DISK_PRICE;

  const price = calcPrice(cpu, ram, disk, cpuPrice, ramPrice, diskPrice);
  const cpuCost = Number((cpu * cpuPrice).toFixed(1));
  const ramCost = Math.round((ram / 1024) * ramPrice);
  const diskCost = Number((disk * diskPrice).toFixed(1));
  const scriptPlaceholder = getSshScriptPlaceholder(image);

  async function handleAskAI(e: React.FormEvent) {
    e.preventDefault();
    if (!requirements.trim()) {
      setRecError("Опишите задачу, чтобы получить рекомендацию");
      return;
    }
    setRecError(null);
    setRecLoading(true);
    try {
      const r = await getHardwareRecommendation(requirements.trim());
      setRec(r);
    } catch (err) {
      setRecError(err instanceof Error ? err.message : "AI недоступен");
    } finally {
      setRecLoading(false);
    }
  }

  function applyRec(config?: { cpu_cores: number; ram_gb: number; disk_size_gb: number }) {
    if (!config) return;
    setCpu(config.cpu_cores);
    setRam(config.ram_gb * 1024);
    setDisk(config.disk_size_gb);
    setPlanId("custom");
    
    // Optional: Smooth scroll to the config sliders
    document.getElementById("config-sliders")?.scrollIntoView({ behavior: 'smooth' });
  }

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
      if (selectedNetworks.length > 0) {
        for (const netId of selectedNetworks) {
          try {
            await attachContainerToNetwork(netId, { container_id: c.container_id });
          } catch (err) {
            console.error(err);
          }
        }
      }
      const existing = JSON.parse(localStorage.getItem("container_ids") ?? "[]") as string[];
      localStorage.setItem("container_ids", JSON.stringify([...existing, c.container_id]));
      navigate(`/servers/${c.container_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка создания");
      setCreating(false);
    }
  }

  const inputCls = "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 placeholder:text-gray-400";

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />

      <div className="relative z-10">
        <Header />
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 pt-6 pb-16">
        <div className="mb-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
            </svg>
            Назад
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 lg:overflow-visible">
          <div className="flex items-center gap-3 border-b border-gray-100 px-8 py-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-700">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900">Создать сервер</h1>
              <p className="text-xs text-gray-400">Выберите конфигурацию и запустите контейнер</p>
            </div>
          </div>

          {/* ── AI recommendation row ── */}
          <div className="border-b border-gray-100 bg-red-50/20 px-6 py-6">
            <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
              <form onSubmit={handleAskAI} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-[12px] shadow-sm">
                    🤖
                  </span>
                  <p className="text-sm font-bold text-gray-800">
                    Подобрать конфигурацию с помощью AI
                  </p>
                </div>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="Например: веб-сервер nginx + Postgres для 10k RPS"
                  className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-red-700 focus:ring-2 focus:ring-red-700/15"
                />
                {recError && <p className="text-xs font-medium text-red-600">{recError}</p>}
                <button
                  type="submit"
                  disabled={recLoading}
                  className="inline-flex w-fit items-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black disabled:opacity-50"
                >
                  {recLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      Анализируем...
                    </span>
                  ) : "Получить рекомендацию"}
                </button>
              </form>

              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
                  Предложения AI
                </p>
                {rec ? (
                  <div className="space-y-3">
                    {([
                      { key: "basic_minimum", label: "Минимум", tone: "bg-red-50 text-red-700 border-red-200" },
                      { key: "optimal", label: "Оптимально", tone: "bg-red-100 text-red-800 border-red-300 ring-1 ring-red-700/20" },
                      { key: "luxury_maximum", label: "С запасом", tone: "bg-red-200/60 text-red-900 border-red-400" },
                    ] as const).map(({ key, label, tone }) => {
                      const cfg = rec[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyRec(cfg)}
                          className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left transition hover:shadow-md ${tone}`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-wider">
                              {label}
                            </span>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-gray-900 shadow-sm opacity-0 transition group-hover:opacity-100">
                              Применить
                            </span>
                          </div>
                          <div className="mb-1.5 text-sm font-bold text-gray-900">
                            {cfg.cpu_cores} CPU · {cfg.ram_gb} ГБ RAM · {cfg.disk_size_gb} ГБ SSD
                          </div>
                          <p className="text-[11px] font-medium leading-relaxed opacity-80">
                            {cfg.reasoning}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center text-center">
                    <span className="mb-2 text-2xl opacity-50">✨</span>
                    <p className="text-sm text-gray-500">
                      Введите требования, и AI подберет<br/> 3 оптимальных профиля ресурсов.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleCreate} className="grid gap-6 px-8 py-8 lg:grid-cols-[1fr_360px]">
            <div className="order-1 min-h-[600px] space-y-10 lg:order-1">
              
              <section>
                <StepHeader step="1" title="Название сервера" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-web-server"
                  className={inputCls + " max-w-sm"}
                />
              </section>

              <section>
                <StepHeader step="2" title="Готовые тарифы" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {PLANS.map((p) => {
                    const pp = calcPrice(p.cpu, p.ram, p.disk, cpuPrice, ramPrice, diskPrice);
                    return (
                      <SelectCard key={p.id} selected={planId === p.id} onClick={() => selectPlan(p.id)}>
                        {p.badge && (
                          <span className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${p.badgeColor}`}>
                            {p.badge}
                          </span>
                        )}
                        <div className="text-sm font-bold text-gray-900">{p.label}</div>
                        {p.id !== "custom" ? (
                          <>
                            <div className="mt-1 text-[11px] text-gray-400">
                              {p.cpu} CPU · {formatRAM(p.ram)}
                            </div>
                            <div className="text-[11px] text-gray-400">{p.disk} ГБ SSD</div>
                            <div className="mt-1.5 text-sm font-bold text-red-700">{formatBYN(pp)} BYN/мес</div>
                          </>
                        ) : (
                          <div className="mt-1 text-xs text-gray-400">Свой выбор</div>
                        )}
                      </SelectCard>
                    );
                  })}
                </div>
              </section>

              <section>
                <StepHeader step="3" title="Операционная система" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {IMAGES.map((img) => (
                    <SelectCard key={img.id} selected={image === img.id} onClick={() => setImage(img.id)}>
                      <div className="mb-2">
                        <img src={img.logo} alt={img.label} className="h-8 w-8 object-contain" loading="lazy" />
                      </div>
                      <div className="text-sm font-bold text-gray-900">{img.label}</div>
                      <div className="mt-0.5 text-xs text-gray-400">{img.desc}</div>
                    </SelectCard>
                  ))}
                </div>
              </section>

              <section>
                <StepHeader step="4" title="Регион / Узел" />
                {nodes.length === 0 ? (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-400">
                    Нет доступных узлов
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {nodes.map((n) => (
                      <SelectCard key={n.node_id} selected={nodeId === n.node_id} onClick={() => setNodeId(n.node_id)}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-gray-900">{n.name}</div>
                            <div className="mt-0.5 font-mono text-xs text-gray-400">{n.ip_address}</div>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${n.status === "online" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                            {n.status}
                          </span>
                        </div>
                      </SelectCard>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <StepHeader step="5" title="Приватные сети" optional />
                {networks.length === 0 ? (
                  <p className="text-sm text-gray-400">У вас пока нет сетей.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {networks.map((n) => (
                      <button
                        key={n.network_id}
                        type="button"
                        onClick={() => toggleNetwork(n.network_id)}
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition ${selectedNetworks.includes(n.network_id) ? "border-red-200 bg-red-50 shadow-sm" : "border-gray-200 bg-gray-50 hover:border-red-200 hover:bg-red-50/40"}`}
                      >
                        <div className="font-semibold text-gray-900">{n.name}</div>
                        <div className="text-xs text-gray-500">{n.subnet}</div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* ── Sliders Section ── */}
              <section id="config-sliders">
                <StepHeader step="6" title="Конфигурация ресурсов" />
                <div className="grid gap-5 rounded-2xl bg-gray-50/50 p-6 ring-1 ring-gray-100">
                  <ConfigSlider
                    label="Процессор"
                    icon="⚙️"
                    value={cpu}
                    min={1}
                    max={16}
                    step={1}
                    unit={(val) => `${val} ${val === 1 ? "ядро" : val < 5 ? "ядра" : "ядер"}`}
                    priceLabel={`+${formatBYN(cpuCost)} BYN`}
                    onChange={handleCustomChange(setCpu)}
                  />
                  
                  <ConfigSlider
                    label="Оперативная память"
                    icon="🧠"
                    value={ram}
                    min={512}
                    max={16384}
                    step={512}
                    unit={(val) => formatRAM(val)}
                    priceLabel={`+${formatBYN(ramCost)} BYN`}
                    onChange={handleCustomChange(setRam)}
                  />
                  
                  <ConfigSlider
                    label="Диск SSD"
                    icon="💾"
                    value={disk}
                    min={10}
                    max={320}
                    step={10}
                    unit="ГБ"
                    priceLabel={`+${formatBYN(diskCost)} BYN`}
                    onChange={handleCustomChange(setDisk)}
                  />
                </div>
              </section>

              <section>
                <StepHeader step="7" title="Скрипт запуска" optional />
                <textarea
                  rows={5}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder={scriptPlaceholder}
                  className={inputCls + " resize-none font-mono text-xs"}
                />
              </section>
            </div>

            {/* Summary block */}
            <div className="order-2 self-start lg:order-2 lg:sticky lg:top-24">
              <div className="space-y-5 rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-inner">
                <h2 className="text-xs font-black uppercase tracking-wider text-gray-400">
                  Итог
                </h2>

                <div className="space-y-2.5">
                  <SummaryRow icon="🖥️" label="Название" value={name || <span className="text-gray-300 italic">не задано</span>} />
                  <SummaryRow icon="🐧" label="ОС" value={IMAGES.find((i) => i.id === image)?.label ?? image} />
                  <SummaryRow icon="📍" label="Регион" value={nodes.find((n) => n.node_id === nodeId)?.name ?? <span className="text-gray-300 italic">не выбран</span>} />
                  <SummaryRow icon="🕸️" label="Сети" value={selectedNetworks.length > 0 ? `${selectedNetworks.length} шт.` : <span className="text-gray-300 italic">не выбраны</span>} />
                  <SummaryRow icon="⚙️" label="CPU" value={`${cpu} ${cpu === 1 ? "ядро" : cpu < 5 ? "ядра" : "ядер"}`} />
                  <SummaryRow icon="🧠" label="RAM" value={formatRAM(ram)} />
                  <SummaryRow icon="💾" label="Диск" value={`${disk} ГБ SSD`} />
                </div>

                <div className="border-t border-gray-200" />

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-400">
                    <span>CPU ({cpu} × {cpuPrice} BYN)</span>
                    <span>{formatBYN(cpuCost)} BYN</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>RAM ({formatRAM(ram)} × {ramPrice} BYN/ГБ)</span>
                    <span>{formatBYN(ramCost)} BYN</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>SSD ({disk} × {diskPrice} BYN)</span>
                    <span>{formatBYN(diskCost)} BYN</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
                    <span>Итого / месяц</span>
                    <span className="text-red-700">{formatBYN(price)} BYN</span>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-xs font-medium text-red-700 ring-1 ring-red-100">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creating || nodes.length === 0 || !name.trim()}
                  className="group relative w-full overflow-hidden rounded-xl bg-red-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-700/30 transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-white/10 transition-transform duration-500 group-hover:translate-x-[200%]" />
                  <span className="relative flex items-center justify-center gap-2">
                    {creating ? "Создание…" : "Создать сервер"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SummaryRow({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
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
