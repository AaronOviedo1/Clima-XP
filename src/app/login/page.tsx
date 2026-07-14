import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { AUTH_HABILITADA } from "@/lib/auth-flag";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  // Con el login oculto no hay pantalla de acceso: se manda al inicio.
  if (!AUTH_HABILITADA) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-3xl">
        <CardContent className="grid items-center gap-8 md:grid-cols-2">
          {/* Logo a la izquierda (arriba en móvil) */}
          <div className="flex flex-col items-center gap-3 text-center">
            <Image
              src="/HD_sinFondo.png"
              alt="ClimaXpress"
              width={1449}
              height={1428}
              priority
              className="h-48 w-auto md:h-64"
            />
            <p className="text-sm text-muted-foreground">
              Administración de rentas
            </p>
          </div>
          {/* Formulario a la derecha */}
          <div>
            <h1 className="mb-4 text-xl font-semibold tracking-tight">
              Iniciar sesión
            </h1>
            <LoginForm />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
