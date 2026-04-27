"use client";

export default function Spinner({ text = "กำลังโหลด..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl px-8 py-6 shadow-2xl flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{text}</p>
      </div>
    </div>
  );
}

export function InlineSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}
