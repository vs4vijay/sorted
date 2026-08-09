import { describe, expect, test } from 'bun:test';
import { StructuredJobDescriptionSchemaV1 } from './position';
const base={schemaVersion:'jd-structure.v1' as const,title:'Senior Backend Engineer',seniority:'Senior',responsibilities:['Build services'],skills:['PostgreSQL'],minimumExperience:5,preferredExperience:7,logistics:[],criteria:[{name:'Backend systems',description:'Builds reliable services',criterionType:'technical',classification:'must_have' as const,weight:100,evidenceExpectations:'Production system evidence'}]};
describe('position rubric contracts',()=>{
 test('accepts a versioned, balanced rubric',()=>expect(StructuredJobDescriptionSchemaV1.parse(base).criteria).toHaveLength(1));
 test('rejects scored weights that do not total 100',()=>expect(()=>StructuredJobDescriptionSchemaV1.parse({...base,criteria:[{...base.criteria[0],weight:80}]})).toThrow());
 test('allows informational criteria at zero without changing the scored total',()=>expect(StructuredJobDescriptionSchemaV1.parse({...base,criteria:[...base.criteria,{...base.criteria[0],name:'Notice period',classification:'informational',weight:0}]}).criteria).toHaveLength(2));
});
