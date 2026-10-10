import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/RecoveryForms';

export const metadata: Metadata = { title: 'Choose a new password' };

// proxy.ts only lets a request here when it carries the temporary session created by the emailed link;
// the reset action checks the session again on the server before changing anything.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
