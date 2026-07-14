"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Algo salió mal al cargar esta pantalla.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Ref: {error.digest}</p>
        )}
        <Button onClick={reset} className="h-11">
          Reintentar
        </Button>
      </CardContent>
    </Card>
  );
}
