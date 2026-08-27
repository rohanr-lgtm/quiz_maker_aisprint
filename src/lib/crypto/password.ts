const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_KEY_BITS = 256;

export type HashedPassword = {
  hash: string;
  salt: string;
};

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function deriveBits(clientHash: string, saltBytes: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(clientHash),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    DERIVED_KEY_BITS
  );
}

/**
 * Derives the server-side stored hash from the client's SHA-256 digest of the
 * plaintext password. Called once at registration with a fresh random salt.
 */
export async function hashPassword(clientHash: string, salt?: Uint8Array): Promise<HashedPassword> {
  const saltBytes = salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await deriveBits(clientHash, saltBytes);

  return { hash: toHex(bits), salt: toHex(saltBytes) };
}

/** Constant-time string comparison to avoid leaking hash-match timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Re-derives the hash from the submitted client digest and stored salt, then
 * compares it to the stored hash. Never compares against the plaintext.
 */
export async function verifyPassword(
  clientHash: string,
  salt: string,
  storedHash: string
): Promise<boolean> {
  const { hash } = await hashPassword(clientHash, fromHex(salt));
  return timingSafeEqual(hash, storedHash);
}
