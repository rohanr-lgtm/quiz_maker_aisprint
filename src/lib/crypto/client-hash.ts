function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hashes a plaintext password with SHA-256 before it ever leaves the browser.
 * The server never sees the plaintext value, only this hex digest.
 */
export async function hashPasswordForTransit(password: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(password)
  );
  return toHex(digest);
}
