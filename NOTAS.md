# Notas — orden del directorio de clientes

Se agregó el botón para alternar el orden de `/clientes` entre **A-Z** (default) y
**Más rentas** (`?orden=rentas`). Dudas que se resolvieron por el lado conservador:

- **Qué cuenta como "los que más me han rentado".** Se usa el mismo número que ya
  muestra la columna **Rentas** de la lista (`_count.rentas`), o sea **todas** las
  rentas del cliente, incluidas las CANCELADAS y las COTIZADAS. Se eligió así para
  que el orden coincida con el número que está a la vista; si prefieres que el
  ranking sea por rentas realmente concluidas, o por **dinero** (lo que más te ha
  dejado cada cliente), es un cambio chico y se ajusta.
- **Empates.** Con el orden por rentas se desempata por nombre (A-Z). Sin eso, los
  cientos de clientes con 0 rentas salían en orden aleatorio y la lista se
  reacomodaba sola en cada carga.
- **El orden no se recuerda entre visitas**: vive en la URL (`?orden=rentas`), así
  que al volver a Clientes desde el menú arranca otra vez en A-Z. Guardarlo por
  usuario requeriría BD o cookie; se dejó fuera por ser más de lo pedido.

No se pudo correr `npm run build` ni `lint` en este worktree (no hay `node_modules`
ni `.env`), así que los cambios se razonaron leyendo el código.
