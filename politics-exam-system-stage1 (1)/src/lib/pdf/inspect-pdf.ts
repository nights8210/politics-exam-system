import "server-only";

export type PdfInspection={ pageCount:number; textLength:number; requiresOcr:boolean; textSample:string };

export async function inspectPdf(buffer:ArrayBuffer):Promise<PdfInspection>{
  const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document=await pdfjs.getDocument({data:new Uint8Array(buffer),useSystemFonts:true}).promise;
  let text="";
  for(let pageNumber=1;pageNumber<=Math.min(document.numPages,5);pageNumber++){
    const page=await document.getPage(pageNumber);
    const content=await page.getTextContent();
    text+=content.items.map(item=>("str" in item?item.str:"")).join(" ")+"\n";
  }
  const compact=text.replace(/\s/g,"");
  return {pageCount:document.numPages,textLength:compact.length,requiresOcr:compact.length<100,textSample:text.slice(0,1000)};
}
