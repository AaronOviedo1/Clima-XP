import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { AUTH_HABILITADA } from "@/lib/auth-flag";

export default function LoginPage() {
  // Con el login oculto no hay pantalla de acceso: se manda al inicio.
  if (!AUTH_HABILITADA) redirect("/");

  // Una sola tarjeta centrada: logo, formulario y nada más. El logo circular es
  // cuadrado (1449×1428), así que en un contenedor cuadrado no se deforma.
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(120%_100%_at_15%_10%,#1d3a5f_0%,#152b47_55%,#0e1f34_100%)] p-6">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-[0_24px_60px_-30px_rgba(0,0,0,.6)]">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/HD_sinFondo.png"
            alt="ClimaXpress"
            width={1449}
            height={1428}
            priority
            className="size-20"
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-foreground">
            Iniciar sesión
          </h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Entra con tu cuenta de ClimaXpress.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
