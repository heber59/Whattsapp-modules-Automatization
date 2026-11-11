'use client';
import { useRouter } from 'next/navigation';
import { LoginForm } from '../portal';
export default function LoginPage() {
  const router = useRouter();
  return <main className="standalone-login"><LoginForm onSuccess={() => router.replace('/businesses')} /></main>;
}
