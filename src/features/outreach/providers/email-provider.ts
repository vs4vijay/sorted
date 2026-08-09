import "server-only";
export type EmailInput={to:string;subject:string;html:string;idempotencyKey:string};
export type EmailResult={provider:"resend"|"fixture";providerMessageId:string;status:"sent"|"simulated"};
export interface EmailProvider{send(input:EmailInput):Promise<EmailResult>}
export class FakeEmailProvider implements EmailProvider{async send(input:EmailInput){return {provider:"fixture" as const,providerMessageId:`simulated-${input.idempotencyKey}`,status:"simulated" as const}}}
export class ResendEmailProvider implements EmailProvider{async send(input:EmailInput){const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${process.env.EMAIL_PROVIDER_API_KEY??process.env.RESEND_API}`,"content-type":"application/json","Idempotency-Key":input.idempotencyKey},body:JSON.stringify({from:process.env.EMAIL_FROM_ADDRESS,to:[input.to],subject:input.subject,html:input.html})});const body=await response.json() as {id?:string;message?:string};if(!response.ok||!body.id)throw new Error(body.message??`Email delivery failed (${response.status})`);return {provider:"resend" as const,providerMessageId:body.id,status:"sent" as const}}}
export function getEmailProvider():EmailProvider{return (process.env.EMAIL_PROVIDER_API_KEY??process.env.RESEND_API)&&process.env.EMAIL_FROM_ADDRESS?new ResendEmailProvider():new FakeEmailProvider()}
