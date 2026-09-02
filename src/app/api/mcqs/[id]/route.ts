import { NextResponse } from "next/server";
import { UpdateMcqInputSchema } from "@/lib/schemas/mcq";
import {
  getMcqById,
  updateMcq,
  deleteMcq,
  InvalidChoicesError,
  McqNotFoundError,
} from "@/lib/services/mcq-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    const mcq = await getMcqById(id);
    if (!mcq) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    return NextResponse.json({ mcq });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = UpdateMcqInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  try {
    const mcq = await updateMcq(id, parsed.data);
    return NextResponse.json({ mcq });
  } catch (error) {
    if (error instanceof InvalidChoicesError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof McqNotFoundError) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    await deleteMcq(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof McqNotFoundError) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
