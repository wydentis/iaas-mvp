import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listNetworks,
  createNetwork,
  updateNetwork,
  deleteNetwork,
  listNetworkContainers,
  attachContainerToNetwork,
  detachContainerFromNetwork,
  listContainers,
  type Network,
  type NetworkAttachment,
  type Container,
} from "../api/requests";
import { getCookie } from "../utils/cookies";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 placeholder:text-gray-400";

export default function Networks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<NetworkAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", description: "", subnet: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [attachForm, setAttachForm] = useState({ container_id: "", ip_address: "" });
  const [attachSaving, setAttachSaving] = useState(false);

  useEffect(() => {
    if (!getCookie("access_token")) {
      navigate("/");
      return;
    }
    loadAll();
  }, [navigate]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [nets, conts] = await Promise.all([listNetworks(), listContainers()]);
      setNetworks(nets ?? []);
      setContainers(conts ?? []);
      if (nets?.length) {
        selectNetwork(nets[0].network_id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить сети");
    } finally {
      setLoading(false);
    }
  }

  async function selectNetwork(id: string) {
    setSelectedId(id);
    setAttachments([]);
    setAttachmentsLoading(true);
    setAttachmentsError(null);
    try {
      const list = await listNetworkContainers(id);
      setAttachments(list ?? []);
    } catch (e) {
      setAttachmentsError(e instanceof Error ? e.message : "Не удалось загрузить подключения");
    } finally {
      setAttachmentsLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Введите название сети");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateNetwork(editingId, {
          name: form.name.trim(),
          description: form.description.trim(),
        });
        setNetworks((prev) => prev.map((n) => (n.network_id === editingId ? updated : n)));
      } else {
        const created = await createNetwork({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          subnet: form.subnet.trim() || undefined,
        });
        setNetworks((prev) => [...prev, created]);
        setSelectedId(created.network_id);
      }
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить сеть");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", description: "", subnet: "" });
  }

  function startEdit(network: Network) {
    setEditingId(network.network_id);
    setForm({
      name: network.name,
      description: network.description ?? "",
      subnet: "",
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить сеть? Сначала убедитесь, что нет подключенных контейнеров.")) return;
    try {
      await deleteNetwork(id);
      setNetworks((prev) => prev.filter((n) => n.network_id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setAttachments([]);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка удаления сети");
    }
  }

  async function handleAttach(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || !attachForm.container_id) return;
    setAttachSaving(true);
    try {
      await attachContainerToNetwork(selectedId, {
        container_id: attachForm.container_id,
        ip_address: attachForm.ip_address.trim() || undefined,
      });
      setAttachForm({ container_id: "", ip_address: "" });
      selectNetwork(selectedId);
    } catch (e) {
      setAttachmentsError(e instanceof Error ? e.message : "Не удалось подключить контейнер");
    } finally {
      setAttachSaving(false);
    }
  }

  async function handleDetach(containerId: string) {
    if (!selectedId) return;
    if (!confirm("Отключить контейнер от сети?")) return;
    try {
      await detachContainerFromNetwork(selectedId, containerId);
      setAttachments((prev) => prev.filter((a) => a.container_id !== containerId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось отключить контейнер");
    }
  }

  const containersMap = useMemo(() => {
    const map: Record<string, Container> = {};
    containers.forEach((c) => (map[c.container_id] = c));
    return map;
  }, [containers]);

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#B42124]">
              Частные сети
            </p>
            <h1 className="text-3xl font-black text-gray-900">Изоляция и сегментация</h1>
            <p className="text-sm text-gray-500">
              Создавайте приватные сети, подключайте контейнеры и управляйте IP-адресами.
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-red-200 hover:text-red-700"
          >
            ← Панель
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Networks list + form */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Сети</h2>
                <span className="text-xs text-gray-400">
                  {networks.length} шт.
                </span>
              </div>
              {loading ? (
                <p className="text-sm text-gray-400">Загрузка…</p>
              ) : networks.length === 0 ? (
                <p className="text-sm text-gray-500">Сетей пока нет.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {networks.map((n) => (
                    <button
                      key={n.network_id}
                      onClick={() => selectNetwork(n.network_id)}
                      className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition ${
                        selectedId === n.network_id
                          ? "border-red-200 bg-red-50 shadow-sm"
                          : "border-gray-200 bg-gray-50 hover:border-red-200 hover:bg-red-50/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="truncate text-sm font-bold text-gray-900">
                          {n.name}
                        </h3>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                          {n.subnet}
                        </span>
                      </div>
                      {n.description && (
                        <p className="line-clamp-2 text-xs text-gray-500">
                          {n.description}
                        </p>
                      )}
                      <div className="mt-2 flex gap-2 text-[11px] text-gray-400">
                        <span>GW {n.gateway}</span>
                        <span>·</span>
                        <span>{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(n);
                          }}
                          className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm transition hover:text-red-700"
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(n.network_id);
                          }}
                          className="rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                        >
                          Удалить
                        </button>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                {editingId ? "Редактировать сеть" : "Создать сеть"}
              </h2>
              <form onSubmit={handleSave} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Название *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="web-tier"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Описание
                  </label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Изолированная сеть для фронтенда"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    Подсеть (опционально)
                  </label>
                  <input
                    value={form.subnet}
                    onChange={(e) => setForm((p) => ({ ...p, subnet: e.target.value }))}
                    placeholder="Авто или 10.100.5.0/24"
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-[#B42124] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                  >
                    {saving ? "Сохранение…" : editingId ? "Сохранить" : "Создать"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-600 transition hover:bg-gray-200"
                    >
                      Отмена
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          {/* Attachments */}
          <div className="rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Подключенные контейнеры</h2>
              {selectedId && (
                <span className="text-xs text-gray-400">
                  сеть {selectedId}
                </span>
              )}
            </div>

            {!selectedId ? (
              <p className="text-sm text-gray-400">Выберите сеть, чтобы увидеть подключения.</p>
            ) : attachmentsLoading ? (
              <p className="text-sm text-gray-400">Загрузка подключений…</p>
            ) : attachmentsError ? (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {attachmentsError}
              </div>
            ) : (
              <>
                {attachments.length === 0 ? (
                  <p className="text-sm text-gray-500">Нет подключённых контейнеров.</p>
                ) : (
                  <div className="mb-4 overflow-x-auto">
                    <div className="min-w-[520px] overflow-hidden rounded-xl border border-gray-100">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                          <tr>
                            <th className="px-4 py-2.5">Контейнер</th>
                            <th className="px-4 py-2.5">IP</th>
                            <th className="px-4 py-2.5 text-right"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {attachments.map((a) => {
                            const c = containersMap[a.container_id];
                            return (
                              <tr key={a.id} className="border-b border-gray-50 last:border-0">
                                <td className="px-4 py-2.5">
                                  <div className="font-semibold text-gray-900 break-words">
                                    {c?.name ?? a.container_id}
                                  </div>
                                  <div className="text-xs text-gray-400 break-words">{c?.image}</div>
                                </td>
                                <td className="px-4 py-2.5 font-mono text-sm text-gray-800">
                                  {a.ip_address}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <button
                                    onClick={() => handleDetach(a.container_id)}
                                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                                  >
                                    Отключить
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Подключить контейнер
                  </h3>
                  <form onSubmit={handleAttach} className="mt-3 flex flex-col gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Контейнер
                      </label>
                      <select
                        required
                        value={attachForm.container_id}
                        onChange={(e) =>
                          setAttachForm((p) => ({ ...p, container_id: e.target.value }))
                        }
                        className={inputCls + " cursor-pointer"}
                      >
                        <option value="">Выберите…</option>
                        {containers.map((c) => (
                          <option key={c.container_id} value={c.container_id}>
                            {c.name} · {c.image}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        IP адрес (опционально)
                      </label>
                      <input
                        value={attachForm.ip_address}
                        onChange={(e) =>
                          setAttachForm((p) => ({ ...p, ip_address: e.target.value }))
                        }
                        placeholder="Авто-назначение"
                        className={inputCls}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={attachSaving || !attachForm.container_id}
                        className="rounded-xl bg-[#B42124] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                      >
                        {attachSaving ? "Подключение…" : "Подключить"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttachForm({ container_id: "", ip_address: "" })}
                        className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm text-gray-600 transition hover:bg-gray-200"
                      >
                        Сбросить
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
