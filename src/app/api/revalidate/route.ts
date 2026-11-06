import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || req.headers.get("x-revalidate-secret") !== secret) {
    return Response.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { paths?: string[]; all?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const done: string[] = [];
  if (body.all) {
    revalidatePath("/", "layout");
    done.push("/ (layout)");
  } else if (Array.isArray(body.paths)) {
    for (const p of body.paths.slice(0, 500)) {
      if (typeof p === "string" && p.startsWith("/")) {
        revalidatePath(p);
        done.push(p);
      }
    }
  } else {
    return Response.json({ ok: false, error: "pass { all: true } or { paths: [...] }" }, { status: 400 });
  }

  return Response.json({ ok: true, revalidated: done, at: new Date().toISOString() });
}

export function GET() {
  return Response.json({ ok: false, error: "POST only" }, { status: 405 });
}
