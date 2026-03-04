import { useNavigate } from "react-router-dom";
import { getAuthDestination } from "../utils/auth";
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

  const heroBg =
    "https://optim.tildacdn.biz/tild3432-6266-4931-b236-333934636334/-/format/webp/image-4.png.webp";

  return (
    <div className="relative min-h-screen bg-[#0d0f14]">
      <Header />

      {/* ── Главный экран ── */}
      <section
        className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6 text-center"
        style={{
          backgroundImage: `url(${heroBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center">
          <h1 className="max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight break-words text-white drop-shadow-lg sm:text-6xl lg:text-8xl">
            Стройте на <span className="text-[#B42124]">Плотине</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg break-words text-white/70 drop-shadow sm:text-xl">
            Заполнитель — вы можете изменить этот текст позже. Мощная облачная
            инфраструктура для современных команд.
          </p>

          {/* CTA */}
          <button
            onClick={handleCTA}
            className="group relative mt-12 inline-flex items-center gap-3 overflow-hidden rounded-2xl bg-[#B42124] px-10 py-4 text-lg font-bold text-white shadow-[0_0_40px_rgba(180,33,36,0.5)] transition-all duration-300 hover:scale-105 hover:bg-[#8f1719] hover:shadow-[0_0_60px_rgba(180,33,36,0.7)]"
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </button>
        </div>

        {/* Прокрутка вниз */}
        <div className="animate-slow-bounce absolute bottom-10 left-1/2 -translate-x-1/2 text-white/40">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19 9-7 7-7-7"
            />
          </svg>
        </div>
      </section>

      {/* ── О нас ── */}
      <section className="relative z-10 bg-[#f2f3f7] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-4xl font-semibold text-[#27272a]">О нас</h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-500">
              Заполнитель — замените на историю компании, миссию и ценности.
              Расскажите пользователям, почему им стоит доверить свою
              инфраструктуру вам.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {CARDS.map(({ icon, title, desc }) => (
              <div
                key={title}
                className="group rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-sm transition hover:border-red-200 hover:shadow-md"
              >
                <div className="mb-4 text-4xl">{icon}</div>
                <h3 className="text-lg font-medium text-[#27272a]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">
                  {desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-14 rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <h3 className="mb-3 text-xl font-medium text-[#27272a]">
              Наша миссия
            </h3>
            <p className="text-gray-500">
              Заполнитель — вы можете дополнить этот раздел информацией о
              команде, историей создания или ключевыми вехами. Весь блок
              доступен для редактирования в любое время.
            </p>
          </div>
        </div>
      </section>

      {/* ── Нижний CTA ── */}
      <section className="relative flex flex-col items-center bg-[#27272a] px-6 py-28 text-center">
        <h2 className="text-4xl font-semibold text-white">Готовы начать?</h2>
        <p className="mt-4 text-lg text-gray-400">
          Присоединяйтесь и возьмите инфраструктуру под полный контроль.
        </p>
        <button
          onClick={handleCTA}
          className="mt-10 rounded-xl bg-[#B42124] px-10 py-3.5 font-bold text-white shadow-lg transition hover:bg-[#8f1719]"
        >
          Начать сейчас →
        </button>
      </section>
    </div>
  );
}
