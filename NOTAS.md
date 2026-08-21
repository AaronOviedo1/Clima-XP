# Notas

## Orden "Más rentas" del directorio de clientes (2026-08-21)

La petición fue que el botón **Más rentas** de `/clientes` no cuente las rentas
CANCELADAS ni las COTIZADAS. Quedó hecho, con dos decisiones que conviene
confirmar porque la petición no las cubría explícitamente:

1. **El número de la columna "Rentas" también dejó de contarlas.** El botón
   ordena por ese número, y mostrar uno (8) mientras se ordena por otro (5) se
   ve como si el orden estuviera roto. Si prefieres que la columna siga
   mostrando el total histórico y que solo cambie el orden, es un cambio de una
   línea.
2. **La edición masiva sigue con el total.** Ahí el conteo no es informativo:
   con él decide qué clientes se pueden borrar, y una renta cancelada sigue
   existiendo en la base de datos y lo impide. Por eso ese pop-up puede decir
   "3 rentas" de un cliente que en la lista aparece con 1.

Sin cambios en la ficha del cliente (`/clientes/[id]`) ni en la tool
`historial_cliente` del copiloto: ahí el conteo sigue siendo el total.
