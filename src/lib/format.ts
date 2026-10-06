export function formatPrice(pesos: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(pesos);
}

/**
 * Lleva un celular argentino a un formato único (549 + 10 dígitos, el que usa WhatsApp),
 * sin importar cómo lo escriba el cliente: "+54 9 11 2345-6789", "011 15 2345 6789", "11 2345 6789"...
 * Devuelve null si no es un número válido.
 */
export function normalizePhone(phone: string): string | null {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9") && d.length === 11) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 12) {
    // Formato viejo con "15" después del código de área (de 2, 3 o 4 dígitos).
    for (const areaLen of [2, 3, 4]) {
      if (d.slice(areaLen, areaLen + 2) === "15") {
        d = d.slice(0, areaLen) + d.slice(areaLen + 2);
        break;
      }
    }
  }
  return /^[1-9]\d{9}$/.test(d) ? `549${d}` : null;
}

export function whatsappLink(phone: string, text: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export const STATUS_LABEL: Record<string, string> = {
  PENDIENTE_WHATSAPP: "Pendiente de confirmación",
  PENDIENTE_PAGO: "Pendiente de pago",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
};

export const CANCEL_REASON_LABEL: Record<string, string> = {
  EXPIRADO: "Venció el plazo para confirmar",
  CLIENTE: "Cancelado por el cliente",
  BARBERO: "Cancelado por la barbería",
  RECHAZADO: "Rechazado por la barbería",
};
