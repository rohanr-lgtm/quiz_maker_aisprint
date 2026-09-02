import { NextResponse } from "next/server";
import { CreateMcqInputSchema } from "@/lib/schemas/mcq";
import { createMcq, listMcqs, InvalidChoicesError } from "@/lib/services/mcq-service";

export async function GET() {
  try {
    const mcqs = await listMcqs();
    return NextResponse.json({ mcqs });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = CreateMcqInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const mcq = await createMcq(parsed.data);
    return NextResponse.json({ mcq }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidChoicesError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
