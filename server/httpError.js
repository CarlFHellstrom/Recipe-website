// Throw one of these from a route to send a specific status + message.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
