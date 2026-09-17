import type { ReactNode } from "react";
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
    <section className="hidden bg-[#14243a] p-14 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-3 text-lg font-semibold"><span className="grid size-10 place-items-center rounded-xl bg-[#b4232d]">政</span>成人高考政治</div>
      <div className="max-w-xl"><p className="mb-5 text-sm tracking-[.24em] text-red-300">专注 · 练习 · 进步</p><h1 className="text-5xl font-bold leading-tight">每一次练习，<br/>都有记录可循。</h1><p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">随机组卷、自动评分、错题复习和多端同步，让三年真题变成持续有效的复习工具。</p></div>
      <p className="text-sm text-slate-400">题目经 OCR 后必须校对确认，避免错误进入正式题库。</p>
    </section>
    <section className="flex items-center justify-center px-5 py-10">{children}</section>
  </main>;
}
