import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { AUTH_HABILITADA } from "@/lib/auth-flag";

function Stat({ valor, label }: { valor: string; label: string }) {
  return (
    <div>
      <div className="font-heading text-2xl font-extrabold">{valor}</div>
      <div className="text-[13px] text-white/55">{label}</div>
    </div>
  );
}

export default function LoginPage() {
  // Con el login oculto no hay pantalla de acceso: se manda al inicio.
  if (!AUTH_HABILITADA) redirect("/");

  return (
    <div className="flex min-h-dvh w-full">
      {/* Panel de marca (oculto en móvil) */}
      <div className="relative hidden flex-[1.05] flex-col justify-center overflow-hidden bg-[radial-gradient(120%_100%_at_15%_10%,#1d3a5f_0%,#152b47_55%,#0e1f34_100%)] px-18 py-16 text-white md:flex">
        <div className="absolute -top-30 -right-30 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(80,173,229,.35),transparent_70%)]" />
        <div className="absolute -bottom-25 -left-20 size-[340px] rounded-full bg-[radial-gradient(circle,rgba(250,185,25,.18),transparent_70%)]" />
        <Image
          src="/logo-app.png"
          alt="ClimaXpress"
          width={1290}
          height={842}
          priority
          className="relative h-32 w-auto drop-shadow-[0_6px_20px_rgba(0,0,0,.3)]"
        />
        <h1 className="font-heading relative mt-5 mb-2 text-[38px] leading-tight font-normal tracking-tight">
          Administración de rentas
        </h1>
        <p className="relative m-0 max-w-105 text-[17px] leading-relaxed text-white/70">
          Aerocoolers en verano, calentones en invierno. Todo tu negocio de
          Hermosillo en un solo panel.
        </p>
        <div className="relative mt-10 flex gap-[26px]">
          <Stat valor="28" label="unidades" />
          <Stat valor="482" label="rentas" />
          <Stat valor="424" label="clientes" />
        </div>
      </div>

      {/* Formulario */}
      <div className="flex flex-1 items-center justify-center bg-card">
        <div className="w-full max-w-90 px-10">
          <h2 className="mb-1.5 text-2xl font-extrabold tracking-tight text-foreground">
            Iniciar sesión
          </h2>
          <p className="mb-7 text-sm text-muted-foreground">
            Entra con tu cuenta de ClimaXpress.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
