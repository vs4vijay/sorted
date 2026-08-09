'use client';

import { useActionState } from 'react';
import { sendMessage, type SendMessageState } from '../actions';

const initialState: SendMessageState = {};

export function SendMessageForm({ messageId, threadId, candidateEmail }: { messageId: string; threadId: string; candidateEmail?: string | null }) {
  const [state, action, pending] = useActionState(sendMessage, initialState);
  const unavailable = !candidateEmail;
  return <form action={action} className="stack-form">
    <input type="hidden" name="messageId" value={messageId}/>
    <input type="hidden" name="threadId" value={threadId}/>
    <button className="button dark" disabled={pending || unavailable}>{pending ? 'Sending…' : 'Send approved email once'}</button>
    {unavailable&&<p className="form-error" role="alert">Add a source-backed candidate email before sending.</p>}
    {state.error&&<p className="form-error" role="alert">{state.error}</p>}
  </form>;
}
