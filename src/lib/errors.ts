/** Error con código HTTP y un mensaje que se puede mostrar al usuario tal cual. */
export class BookingError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
