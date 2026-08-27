import { NextResponse } from "next/server";
import { LoginInputSchema } from "@/lib/schemas/user";
import { getUserByIdentifier } from "@/lib/services/user-service";
import { verifyPassword } from "@/lib/crypto/password";

/** Deliberately generic — never reveal whether the identifier or password was wrong. */
const INVALID_CREDENTIALS_MESSAGE = "Invalid username/email or password";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Username/email and password are required" },
      { status: 400 }
    );
  }

  const parsed = LoginInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Username/email and password are required" },
      { status: 400 }
    );
  }

  try {
    const user = await getUserByIdentifier(parsed.data.identifier);
    if (!user) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
    }

    const isValid = await verifyPassword(
      parsed.data.passwordHash,
      user.passwordSalt,
      user.passwordHash
    );
    if (!isValid) {
      return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
