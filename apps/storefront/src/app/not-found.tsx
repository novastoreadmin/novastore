import Link from "next/link";

// App-wide 404 (rendered by notFound() — e.g. an unknown product handle).
// Without this file Next served its unstyled default page.
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs tracking-[0.3em] uppercase text-text-muted">404</p>
      <h1 className="text-3xl md:text-5xl font-bold text-text-primary">
        Сторінку не знайдено
      </h1>
      <p className="text-sm text-text-muted max-w-md">
        Можливо, товар зняли з продажу або посилання застаріло.
      </p>
      <Link
        href="/"
        className="mt-4 px-6 h-12 inline-flex items-center rounded-xl bg-white text-black text-sm font-medium hover:opacity-90 transition-opacity"
      >
        На головну
      </Link>
    </main>
  );
}
