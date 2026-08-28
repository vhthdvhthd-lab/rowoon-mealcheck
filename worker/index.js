function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function authorized(request, env) {
  const supplied = request.headers.get("x-edit-pin");
  return Boolean(env.EDIT_PIN && supplied && env.EDIT_PIN === supplied);
}

async function handleApi(request, env) {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/auth" && request.method === "POST") {
    if (!env.EDIT_PIN) return json({ error: "EDIT_PIN이 설정되지 않았습니다." }, 503);
    return authorized(request, env) ? json({ ok: true }) : json({ error: "비밀번호가 맞지 않습니다." }, 401);
  }

  if (pathname === "/api/state" && request.method === "GET") {
    if (!env.DB) return json({ error: "D1 데이터베이스가 연결되지 않았습니다." }, 503);
    try {
      const row = await env.DB.prepare("SELECT value, updated_at FROM app_state WHERE key = ?").bind("main").first();
      return json({ state: row ? JSON.parse(row.value) : null, updatedAt: row?.updated_at || null });
    } catch (error) {
      return json({ error: "공용 자료를 불러오지 못했습니다.", detail: String(error) }, 500);
    }
  }

  if (pathname === "/api/state" && request.method === "PUT") {
    if (!env.EDIT_PIN) return json({ error: "EDIT_PIN이 설정되지 않았습니다." }, 503);
    if (!authorized(request, env)) return json({ error: "수정 권한이 없습니다." }, 401);
    if (!env.DB) return json({ error: "D1 데이터베이스가 연결되지 않았습니다." }, 503);
    try {
      const state = await request.json();
      if (!state || !Array.isArray(state.items) || !Array.isArray(state.weeks) || !Array.isArray(state.records) || !Array.isArray(state.incoming)) {
        return json({ error: "저장 자료 형식이 올바르지 않습니다." }, 400);
      }
      const value = JSON.stringify(state);
      if (value.length > 8_000_000) return json({ error: "저장 자료가 너무 큽니다." }, 413);
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).bind("main", value, now).run();
      return json({ ok: true, updatedAt: now });
    } catch (error) {
      return json({ error: "공용 자료를 저장하지 못했습니다.", detail: String(error) }, 500);
    }
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  }
};
