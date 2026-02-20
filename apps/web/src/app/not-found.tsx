import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-bold text-neutral-900">404</h1>
      <p className="mt-2 text-lg text-neutral-600">הדף לא נמצא</p>
      <Link
        href="/"
        className="bg-brand-600 hover:bg-brand-700 mt-6 rounded-lg px-4 py-2 text-sm font-medium text-white"
      >
        חזרה לדף הבית
      </Link>
    </div>
  );
}
