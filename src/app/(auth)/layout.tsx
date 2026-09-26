// Signed-in visitors are sent away from /login by src/proxy.ts
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
