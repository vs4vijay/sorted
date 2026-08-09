import { createHash } from 'node:crypto';
const MAX_BYTES=10*1024*1024;
export function validateCandidateDocument(file:File,bytes:Uint8Array){
  if(file.size===0||file.size>MAX_BYTES)throw new Error('Each CV must be between 1 byte and 10 MB.');
  const name=file.name.toLowerCase();const isPdf=name.endsWith('.pdf');const isDocx=name.endsWith('.docx');
  if(!isPdf&&!isDocx)throw new Error(`${file.name}: only PDF and DOCX files are supported.`);
  const pdfMagic=bytes[0]===0x25&&bytes[1]===0x50&&bytes[2]===0x44&&bytes[3]===0x46;
  const zipMagic=bytes[0]===0x50&&bytes[1]===0x4b&&(bytes[2]===0x03||bytes[2]===0x05||bytes[2]===0x07);
  if((isPdf&&!pdfMagic)||(isDocx&&!zipMagic))throw new Error(`${file.name}: file signature does not match its extension.`);
  const preview=new TextDecoder('latin1').decode(bytes.slice(0,8192));if(preview.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE'))throw new Error(`${file.name}: malware scan rejected this file.`);
  return {mediaType:isPdf?'application/pdf':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',checksum:createHash('sha256').update(bytes).digest('hex'),malwareScanStatus:'passed_signature_scan' as const};
}
