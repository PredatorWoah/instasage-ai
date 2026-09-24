import { AuthGuard } from '@/components/layout/AuthGuard';

// Sends signed-in users away from the login and register pages
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
