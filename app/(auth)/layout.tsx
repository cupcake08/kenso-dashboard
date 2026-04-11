// Pass-through layout. Each auth page (login, onboarding) owns its own
// full-screen layout and background. The previous wrapper wrapped the child
// in a centered fixed-padding box, which prevented the child from using the
// full viewport and painted an extra frame behind it.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
