// Focused layout for log in / sign up / password recovery: no site navigation, one centred card.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-[radial-gradient(60rem_30rem_at_50%_-10%,var(--color-brand-100),transparent)] px-4 py-10 pb-safe sm:py-14">
      {children}
    </main>
  );
}
