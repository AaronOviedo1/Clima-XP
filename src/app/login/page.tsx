import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { AUTH_HABILITADA } from "@/lib/auth-flag";

export default function LoginPage() {
  // Con el login oculto no hay pantalla de acceso: se manda al inicio.
  if (!AUTH_HABILITADA) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/logo.svg"
            alt="ClimaX"
            width={220}
            height={160}
            priority
            unoptimized
          />
          <p className="text-sm text-muted-foreground">
            Administración de rentas
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
