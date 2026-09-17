import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { questionSchema } from "@/lib/validation/question";
async function admin(){ const user=await getCurrentUser(); if(!user)return {error:NextResponse.json({error:"未登录"},{status:401})}; if(user.role!=="ADMIN")return {error:NextResponse.json({error:"无权限"},{status:403})}; return {user}; }
export async function GET(_:NextRequest,{params}:{params:Promise<{id:string}>}){ const user=await getCurrentUser(); if(!user)return NextResponse.json({error:"未登录"},{status:401}); const {id}=await params; const q=await db.question.findFirst({where:{id,deletedAt:null}}); return q?NextResponse.json(q):NextResponse.json({error:"题目不存在"},{status:404}); }
export async function PUT(req:NextRequest,{params}:{params:Promise<{id:string}>}){ const access=await admin(); if(access.error)return access.error; const parsed=questionSchema.safeParse(await req.json()); if(!parsed.success)return NextResponse.json({error:"题目格式不正确",details:parsed.error.flatten()},{status:400}); const {id}=await params; const q=await db.question.update({where:{id},data:{...parsed.data,options:(parsed.data.options??Prisma.JsonNull) as Prisma.InputJsonValue,answer:parsed.data.answer as Prisma.InputJsonValue}}); return NextResponse.json({id:q.id}); }
export async function DELETE(_:NextRequest,{params}:{params:Promise<{id:string}>}){ const access=await admin(); if(access.error)return access.error; const {id}=await params; await db.question.update({where:{id},data:{isActive:false,deletedAt:new Date()}}); return new NextResponse(null,{status:204}); }
