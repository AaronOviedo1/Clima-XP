import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Placeholder para pantallas que se implementan en fases posteriores.
export function PlaceholderPage({
  titulo,
  descripcion,
  fase,
}: {
  titulo: string;
  descripcion: string;
  fase: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{descripcion}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">En construcción</CardTitle>
          <CardDescription>Se implementa en {fase}.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pantalla base lista. La funcionalidad llega en la fase indicada del
          plan.
        </CardContent>
      </Card>
    </div>
  );
}
