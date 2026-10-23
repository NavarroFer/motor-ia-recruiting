// Next llama a register() al arrancar el servidor: ahí se inicia el worker de la cola.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorker } = await import("@/lib/pipeline/queue");
    startWorker();
  }
}
