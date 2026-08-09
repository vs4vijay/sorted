'use client';
import {useActionState} from 'react';
import {createCandidatePrivacyLink,type PrivacyLinkState} from '../actions';
const initial:PrivacyLinkState={};
export function PrivacyLinkForm({candidateId}:{candidateId:string}){const[state,action,pending]=useActionState(createCandidatePrivacyLink,initial);return <div className="privacy-link-panel"><form action={action}><input type="hidden" name="candidateId" value={candidateId}/><button className="button secondary" disabled={pending}>{pending?'Creating secure link…':'Create candidate privacy link'}</button></form>{state.error?<p role="alert" className="form-error">{state.error}</p>:null}{state.url?<div className="privacy-link-result" role="status"><label htmlFor="privacy-link">Secure link · expires in 30 days</label><input id="privacy-link" readOnly value={state.url}/><small>Share only with this candidate. Creating a new link does not revoke earlier links.</small></div>:null}</div>}
