'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { signIn, type AuthState } from './actions';
const initialState: AuthState = {};
export function SignInForm() { const [state, action, pending] = useActionState(signIn, initialState); return <form action={action} className="setup-form"><label htmlFor="email">Work email<input id="email" name="email" type="email" autoComplete="email" required /></label><label htmlFor="password">Password<input id="password" name="password" type="password" autoComplete="current-password" required /></label>{state.message && <p className="form-error" role="alert">{state.message}</p>}<button className="button primary setup-submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button><Link className="auth-link" href="/setup">Create a new workspace</Link></form>; }
