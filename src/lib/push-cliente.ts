// Helpers de navegador para las notificaciones push. Solo corren en el cliente.

export type SuscripcionSerializada = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
};

export function soportaPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS se anuncia como Mac; se distingue porque tiene pantalla táctil.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** En iPhone el push SOLO funciona con la app instalada en la pantalla de inicio. */
export function esStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** La clave VAPID viaja en base64url; PushManager la quiere en bytes. */
function claveEnBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + "=".repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const binario = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function serializar(sub: PushSubscription): SuscripcionSerializada {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    userAgent: navigator.userAgent.slice(0, 300),
  };
}

export async function registrarSW(): Promise<ServiceWorkerRegistration> {
  const registro = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return registro;
}

/** Suscripción ya existente en este dispositivo, si la hay. */
export async function suscripcionActual(): Promise<SuscripcionSerializada | null> {
  if (!soportaPush()) return null;
  const registro = await navigator.serviceWorker.getRegistration();
  const sub = await registro?.pushManager.getSubscription();
  return sub ? serializar(sub) : null;
}

/**
 * Suscribe este dispositivo. Ojo: el permiso debe pedirse ANTES de llamar a
 * esto y como primera instrucción del click (Safari descarta el prompt si el
 * gesto del usuario ya se "gastó" en otro await).
 */
export async function suscribirDispositivo(
  clavePublica: string
): Promise<SuscripcionSerializada> {
  const registro = await registrarSW();
  const existente = await registro.pushManager.getSubscription();
  if (existente) return serializar(existente);

  const sub = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: claveEnBytes(clavePublica),
  });
  return serializar(sub);
}

export async function desuscribirDispositivo(): Promise<string | null> {
  const registro = await navigator.serviceWorker.getRegistration();
  const sub = await registro?.pushManager.getSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  return endpoint;
}
