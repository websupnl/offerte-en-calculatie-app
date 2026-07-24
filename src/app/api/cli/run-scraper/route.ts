import { NextRequest } from "next/server";
import { spawnScraper } from "@/lib/scraper-runner";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { supplier, query } = body as { supplier: string; query: string };
  const activeCompanyId = session.user.activeCompanyId;
  const companySlug = session.user.companies?.find((c) => c.id === activeCompanyId)?.slug ?? "koolhaas";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const { child, args } = spawnScraper(supplier, query, companySlug);

      controller.enqueue(
        encoder.encode(
          `▶ Starten van CLI proces: node ${args.join(" ")}\n--------------------------------------------------\n`,
        ),
      );

      child.stdout.on("data", (data) => {
        controller.enqueue(encoder.encode(data.toString()));
      });

      child.stderr.on("data", (data) => {
        controller.enqueue(encoder.encode(data.toString()));
      });

      child.on("close", (code) => {
        controller.enqueue(
          encoder.encode(`\n--------------------------------------------------\n✔ CLI Proces voltooid met code ${code}\n`),
        );
        controller.close();
      });

      child.on("error", (err) => {
        controller.enqueue(encoder.encode(`\n✖ Fout bij starten CLI proces: ${err.message}\n`));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Transfer-Encoding": "chunked",
    },
  });
}
