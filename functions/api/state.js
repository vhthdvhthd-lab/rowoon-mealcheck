function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function authorized(context) {
  const configured = context.env.EDIT_PIN;
  const supplied = context.request.headers.get("x-edit-pin");
  return Boolean(configured && supplied && configured === supplied);
}

export async function onRequestGet(context) {
  try {
    const row = await context.env.DB.prepare(
      "SELECT value, updated_at FROM app_state WHERE key = ?"
    ).bind("main").first();
    return json({ state: row ? JSON.parse(row.value) : null, updatedAt: row?.updated_at || null });
  } catch (error) {
    return json({ error: "공용 자료를 불러오지 못했습니다.", detail: String(error) }, 500);
  }
}

export async function onRequestPut(context) {
  if (!context.env.EDIT_PIN) return json({ error: "EDIT_PIN이 설정되지 않았습니다." }, 503);
  if (!authorized(context)) return json({ error: "수정 권한이 없습니다." }, 401);
  try {
    const state = await context.request.json();
    if (!state || !Array.isArray(state.items) || !Array.isArray(state.weeks) || !Array.isArray(state.records) || !Array.isArray(state.incoming)) {
      return json({ error: "저장 자료 형식이 올바르지 않습니다." }, 400);
    }
    const value = JSON.stringify(state);
    if (value.length > 8_000_000) return json({ error: "저장 자료가 너무 큽니다." }, 413);
    const now = new Date().toISOString();
    await context.env.DB.prepare(
      `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).bind("main", value, now).run();
    return json({ ok: true, updatedAt: now });
  } catch (error) {
    return json({ error: "공용 자료를 저장하지 못했습니다.", detail: String(error) }, 500);
  }
}
