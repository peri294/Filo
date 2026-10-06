/**
 * Envío de SMS. En producción usa Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM).
 * Sin esas variables, fuera de producción el mensaje se escribe en la consola y queda en
 * `devOutbox` (lo usan los tests); en producción, sin configurar, falla.
 */

export const devOutbox: { phone: string; text: string }[] = [];

export async function sendSms(phone: string, text: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("El envío de SMS no está configurado (TWILIO_*)");
    devOutbox.push({ phone, text });
    if (process.env.NODE_ENV !== "test") console.info(`[SMS a +${phone}] ${text}`);
    return;
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: `+${phone}`, From: from, Body: text }),
  });
  if (!res.ok) throw new Error(`Twilio respondió ${res.status}`);
}
