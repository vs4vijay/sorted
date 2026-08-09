import {describe,expect,test} from 'bun:test';
import {HostedCandidatePrivacyRequestInputSchema} from './privacy';
describe('hosted candidate privacy request',()=>{
  test('requires a request type or email opt-out',()=>{expect(HostedCandidatePrivacyRequestInputSchema.safeParse({details:'Please review this request.',optOutEmail:false}).success).toBe(false)});
  test('accepts a standalone email opt-out',()=>{expect(HostedCandidatePrivacyRequestInputSchema.parse({details:'Please stop all recruiting emails.',optOutEmail:true})).toEqual({details:'Please stop all recruiting emails.',optOutEmail:true})});
  test('rejects unbounded details',()=>{expect(HostedCandidatePrivacyRequestInputSchema.safeParse({requestType:'export',details:'x'.repeat(1001),optOutEmail:false}).success).toBe(false)});
});
