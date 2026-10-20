# Constitución del proyecto

- **Versión:** 2.0.0
- **Vigente desde:** 2026-10-17
- **Aprueba enmiendas:** solo el dueño del proyecto.

Principios que no cambian aunque cambie el código. Orden de prioridad: **constitución > spec > plan > código**.
Cada regla lleva su porqué: ante un caso que la regla no previó, decide el porqué.
Las specs citan los artículos por número (por ejemplo "toca el 3.4").

---

## 1. Propósito y límites del producto

**1.1** Es una plataforma de **turnos online para barberías en Argentina**, con varias barberías (cada una en
`/<slug>`, con su panel y sus barberos) y **una sola cuenta de cliente** para todas.
*Por qué:* el valor está en que reservar sea igual de fácil en cualquier local y que el cliente no tenga que crear
una cuenta por barbería.

**1.2** **No es** tienda, venta de productos, inventario, sistema contable ni red social. Una funcionalidad fuera
de los turnos y de su gestión necesita una enmienda de este artículo.
*Por qué:* el primer plan incluía venta de insumos y se sacó a propósito. Un producto chico y bien hecho le sirve
más al barbero que uno grande a medias.

## 2. Principios de producto

**2.1** **Mobile-first.** Cada pantalla se diseña primero para el celular.
*Por qué:* el cliente reserva desde el teléfono y el barbero mira la agenda entre corte y corte.

**2.2** Toda la UI y los mensajes de error van en **español rioplatense (vos)**, claros y sin jerga técnica.

**2.3** **Pocos pasos.** Reservar sigue el camino servicio → barbero (o "el primero disponible") → día → horario →
confirmación. Agregar un paso obligatorio necesita justificarse en la spec.
*Por qué:* cada paso extra es un cliente que abandona y un turno que el local pierde.

**2.4** Los textos de `/terminos` y `/privacidad` son **borradores** hasta que los revise un abogado. No se
publican como definitivos.

## 3. Invariantes del dominio

**3.1** **Aislamiento entre barberías.** Toda consulta del panel filtra por el `tenantId` del usuario; el barbero,
además, por su `barberId`. Un recurso de otra barbería o de otro barbero responde **404**, sin revelar que existe.
*Por qué:* cada barbería confía sus clientes y su agenda a la plataforma. Una fuga entre locales es el error más
grave que puede tener el producto.

**3.2** **Las garantías críticas viven en la base, no en la aplicación.** Cada bloque de 5 minutos ocupado de cada
barbero (`LOCK_UNIT_MIN`) es una fila de `SlotLock` con clave `(barberId, startsAt)`: la base impide las reservas
dobles. `ClientHold (tenantId, clientId)` garantiza **un turno activo por cliente en cada barbería**. Al cancelar o
vencer un turno se liberan los dos (`releaseHolds`).
*Por qué:* un chequeo previo en el código no aguanta dos reservas simultáneas; una restricción de la base, sí.

**3.3** **Horario efectivo** de un barbero = su horario propio recortado al del local (`barberHours`).

**3.4** **"El primero disponible"** (`ANY_BARBER`) asigna al barbero libre con menos turnos ese día; si choca,
prueba con el siguiente.
*Por qué:* reparte el trabajo de forma pareja sin que el cliente tenga que elegir.

**3.5** **Pago en efectivo:** el turno queda `PENDIENTE_WHATSAPP` por 15 minutos; "Ya envié el mensaje" lo extiende
hasta 12 h, sin pasar el inicio del turno. La confirmación va al WhatsApp del local. Los vencidos se liberan con
`releaseExpired()`, sin cron.
*Por qué:* el local no pierde horarios por reservas que nadie va a confirmar, y el cliente que sí avisó no pierde el
turno mientras el barbero no contesta.

**3.6** El **cliente cancela solo si faltan más de 24 h**. Con menos, tiene que hablar con el local.
*Por qué:* una cancelación de último momento es un horario que ya nadie puede usar.

**3.7** La **asistencia** ("Vino" / "No vino") solo se marca en turnos confirmados que ya empezaron.

**3.8** Todas las fechas y horas de negocio se calculan en **hora de Argentina** (`src/lib/time.ts`), nunca en la
hora del servidor.

## 4. Seguridad y anti-abuso

**4.1** **Límites de login:** cuentan solo los intentos **fallidos**, por IP y por celular. **Nunca un tope
global.**
*Por qué:* un tope global dejaría que una sola persona bloquee el acceso de todos.

**4.2** **SMS:** códigos de un solo uso, con vencimiento y con límites por celular, por IP y un tope diario
(`OTP_DAILY_CAP`) contra el bombeo de SMS. Ningún flujo nuevo manda SMS sin pasar por `src/lib/otp.ts`.
*Por qué:* cada SMS cuesta plata, y un atacante puede usar el sistema para mandar miles.

**4.3** **La IP solo es confiable en Vercel** (`x-real-ip`). Desplegar en otro lado exige adaptar `clientIp` al
proxy de confianza que haya **antes** de salir a producción.
*Por qué:* sin eso, cualquiera falsifica `x-forwarded-for` y esquiva todos los límites por IP.

**4.4** Las claves se guardan con **scrypt** y salt aleatorio, y se comparan en tiempo constante. Las sesiones
viven en la base, con cookies `httpOnly` separadas para el personal y los clientes. **Cambiar la clave cierra las
sesiones.**

**4.5** **Recuperar la clave:** cada uno por SMS. Plan B jerárquico: el admin a sus barberos y el superadmin a los
admins. Nadie recupera una cuenta de su mismo nivel o superior.

**4.6** Toda entrada de la API se valida con **Zod** antes de llegar a la lógica.

**4.7** Una respuesta nunca revela si existe una cuenta, un celular o un recurso ajeno (ver 3.1).

## 5. Datos y dinero

**5.1** **Precios en pesos enteros (`Int`)**, nunca `Float`.
*Por qué:* los decimales flotantes redondean mal la plata.

**5.2** **La base es PostgreSQL** en producción, en desarrollo y en tests (Neon: una rama para cada uno; en el CI,
un Postgres del propio workflow).
*Por qué:* en serverless (Vercel) el disco no persiste, así que una base SQLite se pierde entre despliegues. Además,
Prisma usa un solo proveedor por esquema y los tests tienen que probar la misma base que corre en producción.

**5.3** Las **migraciones ya aplicadas no se editan**: todo cambio de esquema es una migración nueva.

**5.4** Los **datos personales** (celulares, nombres, historial de turnos) se tratan bajo la Ley 25.326 de
Protección de Datos Personales: se guarda solo lo necesario para dar el servicio y no se comparte con terceros
salvo los proveedores que el servicio necesita (por ejemplo, el de SMS).
*Pendiente de decisión del dueño:* si el cliente puede borrar su cuenta y cuánto tiempo se guarda el historial.

**5.5** El `.env` y las credenciales nunca se commitean.

## 6. Arquitectura

**6.1** **La lógica de negocio va en `src/lib/*`.** Las rutas de `src/app/api` solo validan y delegan; la UI no
decide reglas de negocio.
*Por qué:* así la lógica se puede testear sin levantar el servidor, y hay un solo lugar donde cambiarla.

**6.2** `src/lib/tenant.ts` es el **único lugar** que resuelve qué barbería es. Subdominios o dominios propios se
traducen a slug ahí (vía `proxy.ts`).

**6.3** Pensado para **serverless en Vercel**: sin procesos ni cron permanentes. Lo que vence se libera cuando
alguien consulta (por ejemplo, `releaseExpired()`).

**6.4** **Dependencias:** las versiones nuevas y los paquetes con scripts de instalación (`allowScripts`) los
aprueba una persona, revisando el paquete. Nada se agrega "por las dudas".
*Por qué:* cada dependencia es código de un tercero que corre con acceso a todo.

## 7. Calidad y proceso

**7.1** **SDD:** todo comportamiento nuevo arranca con una spec en `docs/specs/` (proceso en
[`flujo-de-trabajo.md`](flujo-de-trabajo.md)). Sin spec `Aprobada` y sin preguntas abiertas no se escribe código.

**7.2** **TDD:** cada tarea arranca con un test que falla por la razón correcta. Un bug se arregla escribiendo
primero el test que lo reproduce.

**7.3** **Trazabilidad:** cada criterio de aceptación `CA-n` de la spec `NNN` tiene al menos un test con
`[NNN-CA-n]` en el nombre (por ejemplo `it("[001-CA-2] …")`). `npm run specs` lo verifica.
*Por qué:* cada spec numera sus criterios desde `CA-1`; sin el número de spec, el test de una podría pasar por el
de otra.

**7.4** **No se relaja ni se borra un test para que pase otro.** Si un test choca con una spec, decide el dueño.

**7.5** Nada está terminado sin `npm run check` en verde (typecheck, lint, tests y build).

**7.6** Los tests nunca usan la base de desarrollo ni la de producción, ni la hora real.

## 8. Decisiones del dueño

Decisiones de negocio ya tomadas. No se rediscuten en una spec: se cambian solo con una enmienda.

**8.1** Hasta **3 reservas por hora por IP**. No se cambia a "1 por IP".

**8.2** La confirmación del pago en efectivo va al **WhatsApp del local**.

**8.3** **Mercado Pago todavía no se integra.** El modelo de datos lo contempla, pero esa parte no se toca hasta
que haya una spec aprobada para hacerlo.

**8.4** Los **reembolsos** (cuando exista Mercado Pago) son **solo totales**.

## 9. Cómo se modifica

**9.1** Solo el **dueño del proyecto** aprueba enmiendas. Nadie más, tampoco una IA, cambia este documento sin su
aprobación explícita.

**9.2** Una spec que choque con la constitución no se aprueba hasta que se enmiende la constitución. Si la enmienda
se acepta, va en el mismo cambio que la spec.

**9.3** **Versionado:** mayor (2.0.0) si se quita o se invierte un principio; menor (1.1.0) si se agrega uno;
parche (1.0.1) si solo se aclara una redacción. Cada cambio se anota abajo.

**9.4** Si cambia una regla, se actualizan en el mismo cambio los tests y la documentación que la reflejan
(`AGENTS.md`, `README.md`).

## Registro de cambios

| Versión | Fecha | Cambio |
| --- | --- | --- |
| 1.0.0 | 2026-10-17 | Primera versión, a partir de las reglas de `CLAUDE.md`, el README y el código. Se fija PostgreSQL para producción. |
| 1.1.0 | 2026-10-18 | 7.3: el ID de un criterio en los tests lleva el número de spec (`[NNN-CA-n]`). 9.4: la guía de los agentes es `AGENTS.md` (antes `CLAUDE.md`). Aprobado por el dueño. |
| 2.0.0 | 2026-10-20 | 5.2: PostgreSQL también en desarrollo y tests (se quita SQLite). 7.6: los tests tampoco usan la base de producción. Spec 001. Aprobado por el dueño. |
