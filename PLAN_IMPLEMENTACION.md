# Plan de Implementación: Web Peluquería (Sistema Exclusivo de Turnos)

## Descripción General
Desarrollar una aplicación web moderna, rápida y mobile-first para una peluquería/barbería enfocada **exclusivamente en la reserva y gestión de turnos**:
1. **Reservar turnos sin inicio de sesión**: El cliente solo ingresa su nombre y número de teléfono/WhatsApp.
2. **Calendario claro e interactivo**: Muestra en tiempo real los días laborables y los horarios disponibles, bloqueando al instante los turnos ya tomados.
3. **Métodos de Pago**:
   - **Mercado Pago (Checkout Pro)**: Redirección automática a la app o web de Mercado Pago. Al completarse el pago, el turno queda 100% confirmado de forma automática.
   - **Efectivo en el local**: Reserva provisional con ventana de **15 minutos** y cuenta regresiva. Requiere confirmación por WhatsApp. Si se confirma, pasa a 100% confirmado; si vencen los 15 minutos sin confirmarse, el turno caduca y se libera el horario en el calendario.
4. **Protección Anti-Spam Estricta por IP**: Límite estricto que impide que una misma dirección IP tenga más de 1 turno activo/pendiente simultáneamente.
5. **Políticas de Cancelación**:
   - **Más de 24hs de anticipación**: El cliente puede cancelar de forma autónoma desde la web en su página de turno (`/turno/[codigo]`). En efectivo se libera el horario; en Mercado Pago se ejecuta la devolución del 100% a través de la API y se libera el horario.
   - **Menos de 24hs de anticipación**: Cancelación web bloqueada para el cliente; requiere comunicación directa con el barbero por WhatsApp.
6. **Panel de Gestión para el Barbero (`/admin`)**: Protegido por PIN/clave para ver la agenda del día y la semana, aceptar o rechazar turnos de WhatsApp y bloquear horarios manualmente por imprevistos.

---

## Modelo de Datos Simplificado (Prisma / SQLite)

Al eliminar la venta de insumos, la base de datos queda compacta y rápida:

```prisma
// Configuración de la Peluquería
model BusinessSetting {
  id               Int      @id @default(autoincrement())
  openingTime      String   @default("09:00") // Formato HH:mm
  closingTime      String   @default("20:00")
  slotDurationMin  Int      @default(30)      // Duración estándar del turno
  daysOpen         String   @default("1,2,3,4,5,6") // Lunes a Sábado
  salonPhone       String   @default("5491100000000") // WhatsApp del barbero
}

// Servicios (Corte clásico, Barba, Corte + Barba, etc.)
model Service {
  id           Int           @id @default(autoincrement())
  name         String
  description  String?
  price        Float
  durationMin  Int           @default(30)
  active       Boolean       @default(true)
  appointments Appointment[]
}

// Turnos / Reservas
model Appointment {
  id             String    @id @default(cuid())
  code           String    @unique // Código ej: TURN-842
  date           String    // YYYY-MM-DD
  startTime      String    // HH:mm
  endTime        String    // HH:mm
  clientName     String
  clientPhone    String
  clientIp       String    // Control anti-spam por IP
  serviceId      Int
  service        Service   @relation(fields: [serviceId], references: [id])
  paymentMethod  String    // "EFECTIVO" | "MERCADOPAGO"
  status         String    @default("CONFIRMADO") // "PENDIENTE_WHATSAPP" | "CONFIRMADO" | "CANCELADO"
  expiresAt      DateTime? // Ventana de 15 min para PENDIENTE_WHATSAPP
  
  // Datos Mercado Pago
  pricePaid      Float?
  mpPreferenceId String?
  mpPaymentId    String?
  refundStatus   String?   // "TOTAL" | null
  refundAmount   Float?
  refundId       String?
  
  createdAt      DateTime  @default(now())
}
```

---

## Estructura de Páginas y Componentes

1. **Página Principal (`/`)**:
   - Hero atractivo de la peluquería.
   - Lista de servicios con precios y duraciones.
   - Botón principal: *"Reservar Turno"*.
   - Botón secundario: *"Consultar mi Turno"*.
2. **Página de Reserva (`/reservar`)**:
   - Paso 1: Selección de servicio.
   - Paso 2: Calendario interactivo con horarios libres en tiempo real (excluye horarios reservados o provisionales activos).
   - Paso 3: Datos del cliente (Nombre y Teléfono). Validación anti-spam por IP.
   - Paso 4: Selección de método de pago (Efectivo vs Mercado Pago).
3. **Confirmación Efectivo (`/reservar/confirmacion-efectivo/[code]`)**:
   - Contador regresivo de 15 minutos en vivo.
   - Botón directo de WhatsApp con mensaje pre-redactado.
   - Botón *"Ya envié el mensaje"* y estado en tiempo real.
4. **Comprobante y Consulta de Turno (`/turno/[code]` y `/consultar-turno`)**:
   - Ficha del turno con código, servicio, fecha y hora.
   - Si faltan >24hs: botón activo para cancelar (y reembolsar 100% si fue Mercado Pago).
   - Si faltan <24hs: botón bloqueado con enlace directo de WhatsApp para hablar con el barbero.
5. **Retorno Mercado Pago (`/pago/exito` y `/pago/fallo`)**:
   - Confirmación inmediata del turno abonado.
6. **Panel Privado del Barbero (`/admin`)**:
   - Acceso con PIN/contraseña.
   - Agenda en tiempo real por fecha (turnos del día, próximos turnos).
   - Botones para confirmar o rechazar turnos de efectivo.
   - Bloqueo manual de horarios (ej. si el barbero sale antes o tiene un imprevisto).

---

## Plan de Verificación
1. **Reserva en Efectivo**: Comprobar bloqueo provisional por 15 minutos, cuenta regresiva y liberación si expira.
2. **Reserva Mercado Pago**: Comprobar generación de preferencia y confirmación automática.
3. **Anti-Spam por IP**: Comprobar que no se permite duplicar reservas activas desde la misma conexión.
4. **Cancelación**: Comprobar que a >24hs permite cancelar autónomo y a <24hs se bloquea.
5. **Panel Barbero**: Comprobar gestión de turnos y bloqueo de horarios.
