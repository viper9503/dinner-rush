/**
 * SSE live order feed. Pushes the composed cart view roughly once a second so
 * the tracking page auto-updates with no manual refresh. Closes itself shortly
 * after the order reaches a terminal state, or when the client disconnects.
 */
import { composeCartView } from "@/lib/dr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMINAL = new Set(["delivered", "cancelled", "failed"]);

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", close);

      let terminalSeenAt = 0;
      const tick = async () => {
        try {
          const view = await composeCartView(id);
          if (!view.order) {
            send({ error: "not found" });
            close();
            return;
          }
          send(view);
          if (TERMINAL.has(view.order.status)) {
            if (!terminalSeenAt) terminalSeenAt = Date.now();
            else if (Date.now() - terminalSeenAt > 2500) close();
          }
        } catch {
          /* transient read error; keep the stream open */
        }
      };

      await tick();
      const timer = setInterval(tick, 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
