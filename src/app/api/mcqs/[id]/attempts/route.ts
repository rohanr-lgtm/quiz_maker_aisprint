import { NextResponse } from "next/server";
import { AttemptInputSchema } from "@/lib/schemas/attempt";
import { createAttempt, ChoiceNotFoundError } from "@/lib/services/attempt-service";
import { getMcqById } from "@/lib/services/mcq-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = AttemptInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const mcq = await getMcqById(id);
    if (!mcq) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const attempt = await createAttempt(id, parsed.data);
    return NextResponse.json({ attempt }, { status: 201 });
  } catch (error) {
    if (error instanceof ChoiceNotFoundError) {
      return NextResponse.json({ error: error.message || "Invalid choice" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
