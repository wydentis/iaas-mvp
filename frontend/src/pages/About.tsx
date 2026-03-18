import Header from "../components/Header";

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto flex max-w-4xl px-4 py-16 sm:px-6">
        <section className="w-full rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold text-gray-900 sm:text-4xl">
            О себе
          </h1>
          <div className="mt-6 grid gap-8 md:grid-cols-[220px_1fr]">
            <img
              src="/my_photos.jpg"
              alt="Мое фото"
              className="flex h-64 w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-100 text-sm font-medium text-gray-500"
            />
            <div className="space-y-4 text-lg leading-relaxed text-gray-700">
              <p>Я Кирилл Сапего учащийся Лицея БГУ 11 ИФ класса</p>
              <p>
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Iste
                necessitatibus quas sequi voluptate officia! Quasi labore
                aliquid nesciunt, rem odio vitae sunt officia. Exercitationem
                eos nulla voluptatum unde, quos ad.
              </p>
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
                eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
