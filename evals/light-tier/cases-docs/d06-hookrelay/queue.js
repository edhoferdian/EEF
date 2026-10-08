const pending = [];

export async function enqueue(source, body) {
  pending.push({ source, body, receivedAt: Date.now() });
}
