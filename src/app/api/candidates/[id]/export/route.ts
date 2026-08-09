import { requireCurrentAccess } from "@/lib/auth/session";
import { CandidatePrivacyRepository } from "@/features/candidates/repositories/candidate-privacy-repository";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function GET(_request:Request, context:{params:Promise<{id:string}>}){
  const access=await requireCurrentAccess("candidates:export");
  await enforceRateLimit(access.organization.id,access.userId,'candidate_export');
  const {id}=await context.params;
  const bundle=await new CandidatePrivacyRepository().exportBundle(access.organization.id,id);
  if(!bundle)return Response.json({error:"Candidate not found."},{status:404});
  return new Response(JSON.stringify(bundle,null,2),{headers:{"content-type":"application/json; charset=utf-8","content-disposition":`attachment; filename="candidate-${id}-export.json"`,"cache-control":"private, no-store"}});
}
