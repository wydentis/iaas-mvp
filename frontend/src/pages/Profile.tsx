import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getUserInfo,
  updateUserInfo,
  updatePassword,
} from "../api/requests";
import type { UserInfo } from "../api/requests";
import { getCookie } from "../utils/cookies";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";

type Tab = "info" | "password";

const EMPTY_INFO: UserInfo = {
  username: "",
  name: "",
  surname: "",
  email: "",
  phone: "",
};

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-red-700 focus:bg-white focus:ring-2 focus:ring-red-700/15 disabled:bg-gray-100";

export default function Profile() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("info");

  const [info, setInfo] = useState<UserInfo>(EMPTY_INFO);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [passwords, setPasswords] = useState({ password: "", password_confirm: "" });
  const [passLoading, setPassLoading] = useState(false);
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!getCookie("access_token")) {
      navigate("/");
      return;
    }
    getUserInfo()
      .then((d) => setInfo(d))
      .catch(() => navigate("/"))
      .finally(() => setInfoLoading(false));
  }, [navigate]);

  function handleInfoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInfo((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleInfoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInfoMsg(null);
    setInfoSaving(true);
    try {
      const updated = await updateUserInfo(info);
      setInfo(updated);
      setInfoMsg({ ok: true, text: "Личные данные обновлены." });
    } catch (err) {
      setInfoMsg({ ok: false, text: err instanceof Error ? err.message : "Ошибка обновления" });
    } finally {
      setInfoSaving(false);
    }
  }

  function handlePassChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPasswords((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handlePassSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPassMsg(null);
    if (passwords.password !== passwords.password_confirm) {
      setPassMsg({ ok: false, text: "Пароли не совпадают." });
      return;
    }
    setPassLoading(true);
    try {
      await updatePassword(passwords);
      setPasswords({ password: "", password_confirm: "" });
      setPassMsg({ ok: true, text: "Пароль успешно изменён." });
    } catch (err) {
      setPassMsg({ ok: false, text: err instanceof Error ? err.message : "Ошибка обновления" });
    } finally {
      setPassLoading(false);
    }
  }

  const TAB_LABELS: Record<Tab, string> = {
    info: "Личные данные",
    password: "Смена пароля",
  };

  const INFO_FIELDS: { name: keyof UserInfo; label: string; type?: string }[] = [
    { name: "username", label: "Имя пользователя" },
    { name: "name",     label: "Имя" },
    { name: "surname",  label: "Фамилия" },
    { name: "email",    label: "Email",    type: "email" },
    { name: "phone",    label: "Телефон",  type: "tel" },
  ];

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />

      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Tabs */}
          <div className="flex rounded-t-2xl bg-gray-50 p-1.5 gap-1">
            {(["info", "password"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 ${
                  tab === t
                    ? "bg-white text-red-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>

          <div className="px-8 py-8">
            {/* ── Личные данные ── */}
            {tab === "info" && (
              <div className="animate-fade-slide-in">
                {infoLoading ? (
                  <p className="text-center text-sm text-gray-400">Загрузка…</p>
                ) : (
                  <form onSubmit={handleInfoSubmit} className="space-y-4">
                    {INFO_FIELDS.map(({ name, label, type = "text" }) => (
                      <div key={name}>
                        <label className="mb-1.5 block text-sm font-medium text-gray-600">
                          {label}
                        </label>
                        <input
                          type={type}
                          name={name}
                          required
                          value={info[name]}
                          onChange={handleInfoChange}
                          className={inputCls}
                        />
                      </div>
                    ))}

                    {infoMsg && (
                      <div
                        className={`animate-fade-slide-in rounded-xl px-4 py-3 text-sm font-medium ${
                          infoMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                        }`}
                      >
                        {infoMsg.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={infoSaving}
                      className="group relative w-full overflow-hidden rounded-xl bg-red-900 py-3 text-sm font-bold text-white transition-all hover:bg-red-800 disabled:opacity-60"
                    >
                      <span className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-white/10 transition-transform duration-500 group-hover:translate-x-[200%]" />
                      <span className="relative">{infoSaving ? "Сохранение…" : "Сохранить изменения"}</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ── Смена пароля ── */}
            {tab === "password" && (
              <div className="animate-fade-slide-in">
                <form onSubmit={handlePassSubmit} className="space-y-4">
                  {(
                    [
                      { name: "password",         label: "Новый пароль" },
                      { name: "password_confirm",  label: "Подтвердите пароль" },
                    ] as { name: keyof typeof passwords; label: string }[]
                  ).map(({ name, label }) => (
                    <div key={name}>
                      <label className="mb-1.5 block text-sm font-medium text-gray-600">
                        {label}
                      </label>
                      <input
                        type="password"
                        name={name}
                        required
                        value={passwords[name]}
                        onChange={handlePassChange}
                        placeholder="••••••••"
                        className={inputCls}
                      />
                    </div>
                  ))}

                  {passMsg && (
                    <div
                      className={`animate-fade-slide-in rounded-xl px-4 py-3 text-sm font-medium ${
                        passMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {passMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={passLoading}
                    className="group relative w-full overflow-hidden rounded-xl bg-red-900 py-3 text-sm font-bold text-white transition-all hover:bg-red-800 disabled:opacity-60"
                  >
                    <span className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-white/10 transition-transform duration-500 group-hover:translate-x-[200%]" />
                    <span className="relative">{passLoading ? "Обновление…" : "Обновить пароль"}</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
