import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  const nombre = session?.user?.name ?? "Usuario";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hoy</h1>
        <p className="text-sm text-muted-foreground">Hola, {nombre}.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dashboard del día</CardTitle>
          <CardDescription>
            Entregas y recolecciones de hoy, alertas de saldos.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Se implementa en la Fase 3. Por ahora, el esqueleto de la app está
          listo: auth con roles, navegación mobile-first y base de datos
          configurada.
        </CardContent>
      </Card>
    </div>
  );
}
