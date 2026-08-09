import { describe, expect, test } from "bun:test";
import { FairnessRepository } from "./fairness-repository";

describe("fairness repository tenant boundary",()=>{
  test("organization-scopes evaluation list and every reconstruction query",async()=>{const calls:Array<{sql:string;params?:unknown[]}>=[];const repository=new FairnessRepository(async(sql,params)=>{calls.push({sql,params});return []});await repository.listEvaluations("org-a");expect(await repository.reconstruct("org-a","evaluation-b")).toBeNull();expect(calls).toHaveLength(2);for(const call of calls){expect(call.sql).toContain("organization_id=$1");expect(call.params?.[0]).toBe("org-a")}});
  test("a cross-organization evaluation resolves to no record",async()=>{const repository=new FairnessRepository(async(sql,params)=>{expect(sql).toContain("ce.organization_id=$1");expect(params).toEqual(["org-a","evaluation-owned-by-org-b"]);return []});expect(await repository.reconstruct("org-a","evaluation-owned-by-org-b")).toBeNull()});
});
