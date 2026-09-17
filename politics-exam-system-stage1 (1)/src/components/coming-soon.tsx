import { Construction } from "lucide-react";
export function ComingSoon({title}:{title:string}){return <div className="card grid min-h-72 place-items-center p-8 text-center"><div><Construction className="mx-auto text-[#b4232d]" size={38}/><h2 className="mt-4 text-xl font-bold">{title}</h2><p className="mt-2 text-slate-500">数据库和页面入口已经预留，将在下一阶段接入完整业务逻辑。</p></div></div>}
