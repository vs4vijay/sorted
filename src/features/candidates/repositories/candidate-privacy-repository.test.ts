import { describe, expect, test } from "bun:test";
import { CandidatePrivacyRepository } from "./candidate-privacy-repository";

describe("candidate privacy repository", () => {
  test("scopes export data to organization and candidate", async () => {
    const calls:{sql:string;params?:unknown[]}[]=[];
    const repo=new CandidatePrivacyRepository(async(sql,params)=>{calls.push({sql,params});return sql.startsWith("SELECT id,display_name")?[{id:"candidate-a"}]:[]});
    await repo.exportBundle("org-a","candidate-a");
    expect(calls.length).toBeGreaterThan(4);
    for(const call of calls) expect(call.params?.slice(0,2)).toEqual(["org-a","candidate-a"]);
  });
  test("does not create a request for a cross-organization candidate", async()=>{
    const repo=new CandidatePrivacyRepository(async()=>[]);
    await expect(repo.request("org-a","actor",{candidateId:"f2d7256c-346a-4fe4-a13f-65f408695ed2",requestType:"export",details:"Candidate requested a portable copy."})).rejects.toThrow("not found");
  });
});
