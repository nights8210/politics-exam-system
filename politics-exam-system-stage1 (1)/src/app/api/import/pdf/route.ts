import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspectPdf } from "@/lib/pdf/inspect-pdf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime="nodejs";
export async function POST(request:Request){
  const user=await getCurrentUser();
  if(!user)return NextResponse.json({error:"未登录"},{status:401});
  if(user.role!=="ADMIN")return NextResponse.json({error:"无权限"},{status:403});
  const form=await request.formData(); const file=form.get("file");
  if(!(file instanceof File))return NextResponse.json({error:"请选择 PDF 文件"},{status:400});
  if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf"))return NextResponse.json({error:"仅支持 PDF 文件"},{status:400});
  const maxMb=Number(process.env.MAX_PDF_SIZE_MB??20);
  if(file.size>maxMb*1024*1024)return NextResponse.json({error:`文件不能超过 ${maxMb}MB`},{status:413});
  const bytes=await file.arrayBuffer(); const hash=createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
  const duplicate=await db.pdfImport.findFirst({where:{importedById:user.id,fileHash:hash,status:{not:"FAILED"}}});
  if(duplicate)return NextResponse.json({error:"这份 PDF 已上传过",importId:duplicate.id},{status:409});
  let inspection;
  try{ inspection=await inspectPdf(bytes); }catch{ inspection={pageCount:0,textLength:0,requiresOcr:true,textSample:""}; }
  const safeName=file.name.replace(/[^\p{L}\p{N}._-]+/gu,"_"); const storageKey=`${user.id}/${Date.now()}-${randomUUID()}-${safeName}`; const bucket=process.env.SUPABASE_PDF_BUCKET??"exam-pdfs"; const supabase=createSupabaseAdminClient();
  const {error:uploadError}=await supabase.storage.from(bucket).upload(storageKey,new Uint8Array(bytes),{contentType:"application/pdf",upsert:false});
  if(uploadError)return NextResponse.json({error:`文件存储失败：${uploadError.message}`},{status:500});
  try{
    const record=await db.pdfImport.create({data:{importedById:user.id,originalFilename:file.name,storageKey,fileHash:hash,pageCount:inspection.pageCount||null,requiresOcr:inspection.requiresOcr,status:inspection.requiresOcr?"PENDING_OCR":"PENDING_PARSE",metadata:{textLength:inspection.textLength,textSample:inspection.textSample}}});
    return NextResponse.json({id:record.id,status:record.status,requiresOcr:record.requiresOcr},{status:202});
  }catch(error){ await supabase.storage.from(bucket).remove([storageKey]); throw error; }
}
