export async function cancelBodyQuietly(body) {
  try { await body?.cancel?.() } catch {}
}
