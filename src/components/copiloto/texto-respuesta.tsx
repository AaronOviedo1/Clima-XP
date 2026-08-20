import { Fragment } from "react";

// El modelo contesta en texto con un poco de markdown (negritas con ** y listas
// con guiones). Se pinta con nodos de React, nunca como HTML: lo que diga el
// modelo (o un nombre de cliente que venga dentro) es texto, no marcado.

function conNegritas(linea: string, key: string) {
  const partes = linea.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return partes.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${key}-${i}`} className="font-bold">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${key}-${i}`}>{p}</Fragment>
    ),
  );
}

export function TextoRespuesta({ texto }: { texto: string }) {
  const lineas = texto.split("\n");
  const bloques: { tipo: "p" | "ul"; lineas: string[] }[] = [];
  for (const cruda of lineas) {
    const l = cruda.trimEnd();
    if (!l.trim()) continue;
    const esItem = /^\s*[-•*]\s+/.test(l);
    const ultimo = bloques.at(-1);
    if (esItem) {
      const item = l.replace(/^\s*[-•*]\s+/, "");
      if (ultimo?.tipo === "ul") ultimo.lineas.push(item);
      else bloques.push({ tipo: "ul", lineas: [item] });
    } else {
      bloques.push({ tipo: "p", lineas: [l.trim()] });
    }
  }
  return (
    <div className="space-y-2 text-[14.5px] leading-snug">
      {bloques.map((b, i) =>
        b.tipo === "ul" ? (
          <ul key={i} className="space-y-1 pl-4">
            {b.lineas.map((l, j) => (
              <li key={j} className="list-disc">
                {conNegritas(l, `${i}-${j}`)}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{conNegritas(b.lineas[0], String(i))}</p>
        ),
      )}
    </div>
  );
}
