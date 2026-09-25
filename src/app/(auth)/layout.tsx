import { AuthGuard } from '@/components/layout/AuthGuard';

// Sends signed-in users away from the login page
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
