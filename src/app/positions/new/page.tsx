import { AppShell, PageHeader } from '@/components/recruiting/app-shell';
import { PositionForm } from './position-form';
export default function NewPositionPage() { return <AppShell active="positions"><PageHeader title="Create a position" description="Paste a JD for Sarvam-assisted structuring, or leave it blank to begin with a manual draft rubric."/><PositionForm/></AppShell>; }
