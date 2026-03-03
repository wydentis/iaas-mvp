import { useNavigate } from "react-router-dom";
import { getAuthDestination } from "../utils/auth";
import AnimatedBackground from "../components/AnimatedBackground";
import Header from "../components/Header";

const CARDS = [
  {
    icon: "⚡",
    title: "Высокая производительность",
    desc: "Заполнитель — опишите производительность вашей инфраструктуры здесь.",
  },
  {
    icon: "🛡️",
    title: "Надёжно и безопасно",
    desc: "Заполнитель — опишите надёжность и безопасность здесь.",
  },
  {
    icon: "📈",
    title: "Неограниченный рост",
    desc: "Заполнитель — опишите возможности масштабирования здесь.",
  },
];

export default function Home() {
  const navigate = useNavigate();

  function handleCTA() {
    navigate(getAuthDestination());
  }

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />
      <Header />

      {/* ── Главный экран ── */}
      <section className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6 text-center">
        <div className="animate-float mb-6 inline-block rounded-full border border-red-500/40 bg-red-900/40 px-5 py-1.5 text-xs font-semibold uppercase tracking-widest text-red-300 backdrop-blur-sm">
          Инфраструктура как сервис
        </div>

        <h1 className="max-w-3xl text-6xl font-black leading-[1.05] tracking-tight text-white sm:text-7xl lg:text-8xl">
          Стройте на{" "}
          <span className="bg-gradient-to-r from-red-400 via-rose-300 to-orange-300 bg-clip-text text-transparent">
            Плотине
          </span>
        </h1>

        <p className="mt-6 max-w-xl text-lg text-red-100/60 sm:text-xl">
          Заполнитель — вы можете изменить этот текст позже. Мощная облачная
          инфраструктура для современных команд.
        </p>

        {/* CTA */}
        <button
          onClick={handleCTA}
          className="group relative mt-12 inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-red-700 via-rose-700 to-red-700 bg-[length:200%_100%] px-10 py-4 text-lg font-bold text-white shadow-[0_0_50px_rgba(185,28,28,0.55)] transition-all duration-300 hover:bg-right hover:scale-105 hover:shadow-[0_0_80px_rgba(225,29,72,0.65)]"
        >
          <span className="absolute inset-0 translate-x-[-100%] skew-x-[-20deg] bg-white/10 transition-transform duration-500 group-hover:translate-x-[200%]" />
          <span className="relative">Перейти в панель</span>
          <svg
            className="relative h-5 w-5 transition-transform duration-200 group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>

        {/* Прокрутка вниз */}
        <div className="animate-slow-bounce absolute bottom-10 left-1/2 -translate-x-1/2 text-red-500/50">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── О нас ── */}
      <section className="relative z-10 bg-neutral-950/85 px-6 py-24 backdrop-blur-md">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <span className="mb-3 inline-block text-xs font-semibold uppercase tracking-widest text-red-500">
              Кто мы
            </span>
            <h2 className="text-4xl font-black text-white">О нас</h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              Заполнитель — замените на историю компании, миссию и ценности.
              Расскажите пользователям, почему им стоит доверить свою
              инфраструктуру вам.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {CARDS.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-2xl border border-red-900/40 bg-gradient-to-b from-red-950/60 to-neutral-950/60 p-7 backdrop-blur-sm transition hover:border-red-700/60 hover:shadow-[0_0_30px_rgba(185,28,28,0.2)]"
              >
                <div className="mb-4 text-4xl">{icon}</div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-red-900/30 bg-red-950/30 p-8 backdrop-blur-sm">
            <h3 className="mb-3 text-xl font-bold text-white">Наша миссия</h3>
            <p className="text-gray-400">
              Заполнитель — вы можете дополнить этот раздел информацией о команде,
              историей создания или ключевыми вехами. Весь блок доступен для
              редактирования в любое время.
            </p>
          </div>
        </div>
      </section>

      {/* ── Нижний CTA ── */}
      <section className="relative flex flex-col items-center px-6 py-28 text-center">
        <h2 className="text-4xl font-black text-white">Готовы начать?</h2>
        <p className="mt-4 text-lg text-red-200/60">
          Присоединяйтесь и возьмите инфраструктуру под полный контроль.
        </p>
        <button
          onClick={handleCTA}
          className="mt-10 rounded-xl border-2 border-white/20 bg-white/10 px-10 py-3.5 font-bold text-white backdrop-blur-sm transition hover:bg-white hover:text-red-900"
        >
          Начать сейчас →
        </button>
      </section>
    </div>
  );
}
