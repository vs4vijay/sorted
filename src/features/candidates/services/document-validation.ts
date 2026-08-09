import { createHash } from 'node:crypto';
const MAX_BYTES=10*1024*1024;
export function validateCandidateDocument(file:File,bytes:Uint8Array){
  if(file.size===0||file.size>MAX_BYTES)throw new Error('Each CV must be between 1 byte and 10 MB.');
  const name=file.name.toLowerCase();const isPdf=name.endsWith('.pdf');const isDocx=name.endsWith('.docx');
  if(!isPdf&&!isDocx)throw new Error(`${file.name}: only PDF and DOCX files are supported.`);
  const pdfMagic=bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46&&bytes[4]===0x2d;
  const zipMagic=bytes[0]===0x50&&bytes[1]===0x4b&&(bytes[2]===0x03||bytes[2]===0x05||bytes[2]===0x07);
  if((isPdf&&!pdfMagic)||(isDocx&&!zipMagic))throw new Error(`${file.name}: file signature does not match its extension.`);
  const claimed=file.type.toLowerCase();const expected=isPdf?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if(claimed&&claimed!=='application/octet-stream'&&claimed!==expected)throw new Error(`${file.name}: browser content type does not match the document format.`);
  const content=new TextDecoder('latin1').decode(bytes);
  if(isPdf){if(!content.slice(-2048).includes('%%EOF'))throw new Error(`${file.name}: incomplete PDF structure.`);if(/\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(content))throw new Error(`${file.name}: active or embedded PDF content is not allowed.`)}
  if(isDocx&&(!content.includes('[Content_Types].xml')||!content.includes('word/document.xml')))throw new Error(`${file.name}: ZIP content is not a valid DOCX document.`);
  return {mediaType:expected,checksum:createHash('sha256').update(bytes).digest('hex')};
}
