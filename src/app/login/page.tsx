import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Climaxpress</h1>
          <p className="text-sm text-muted-foreground">
            Administración de rentas
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
