function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

async function handleApi(request, env) {
  const { pathname } = new URL(request.url);
  if (pathname === "/api/auth" && request.method === "POST") {
    return json({ ok: true });
  }

  if (pathname === "/api/state" && request.method === "GET") {
    if (!env.DB) return json({ error: "D1 데이터베이스가 연결되지 않았습니다." }, 503);
    try {
      const result = await env.DB.prepare("SELECT key, value, updated_at FROM app_state").all();
      const rows = result.results || [];
      let globalRow = rows.find((row) => row.key === "global");
      const legacyRow = rows.find((row) => row.key === "main");

      // 기존 한 묶음 자료는 삭제하지 않고 주차별 행으로 자동 복사합니다.
      if (!globalRow && legacyRow) {
        const legacy = JSON.parse(legacyRow.value);
        const now = new Date().toISOString();
        const weekStarts = new Set([
          ...(legacy.weeks || []).map((week) => week.start),
          ...(legacy.records || []).map((record) => record.weekly_record_id),
          ...(legacy.incoming || []).map((entry) => entry.weekly_record_id)
        ].filter(Boolean));
        const statements = [
          env.DB.prepare(
            `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          ).bind("global", JSON.stringify({ items: legacy.items || [], weeks: legacy.weeks || [] }), now)
        ];
        for (const start of weekStarts) {
          statements.push(env.DB.prepare(
            `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
          ).bind(`week:${start}`, JSON.stringify({
            records: (legacy.records || []).filter((record) => record.weekly_record_id === start),
            incoming: (legacy.incoming || []).filter((entry) => entry.weekly_record_id === start)
          }), now));
        }
        await env.DB.batch(statements);
        globalRow = { key: "global", value: JSON.stringify({ items: legacy.items || [], weeks: legacy.weeks || [] }), updated_at: now };
        const refreshed = await env.DB.prepare("SELECT key, value, updated_at FROM app_state WHERE key LIKE 'week:%'").all();
        rows.push(...(refreshed.results || []));
      }

      if (!globalRow) return json({ state: null, updatedAt: null });
      const global = JSON.parse(globalRow.value);
      const records = [], incoming = [];
      const seen = new Set();
      for (const row of rows) {
        if (!row.key.startsWith("week:") || seen.has(row.key)) continue;
        seen.add(row.key);
        const weekly = JSON.parse(row.value);
        records.push(...(weekly.records || []));
        incoming.push(...(weekly.incoming || []));
      }
      return json({ state: { items: global.items || [], weeks: global.weeks || [], records, incoming }, updatedAt: globalRow.updated_at || null });
    } catch (error) {
      return json({ error: "공용 자료를 불러오지 못했습니다.", detail: String(error) }, 500);
    }
  }

  if (pathname === "/api/state" && request.method === "PUT") {
    if (!env.DB) return json({ error: "D1 데이터베이스가 연결되지 않았습니다." }, 503);
    try {
      const state = await request.json();
      if (!state || !Array.isArray(state.items) || !Array.isArray(state.weeks) || !Array.isArray(state.records) || !Array.isArray(state.incoming)) {
        return json({ error: "저장 자료 형식이 올바르지 않습니다." }, 400);
      }
      if (new URL(request.url).searchParams.get("restore") === "1") {
        const now = new Date().toISOString();
        const weekStarts = new Set([
          ...state.weeks.map((week) => week.start),
          ...state.records.map((record) => record.weekly_record_id),
          ...state.incoming.map((entry) => entry.weekly_record_id)
        ].filter(Boolean));
        const upsert = `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`;
        const statements = [env.DB.prepare(upsert).bind("global", JSON.stringify({ items: state.items, weeks: state.weeks }), now)];
        for (const start of weekStarts) {
          statements.push(env.DB.prepare(upsert).bind(`week:${start}`, JSON.stringify({
            records: state.records.filter((record) => record.weekly_record_id === start),
            incoming: state.incoming.filter((entry) => entry.weekly_record_id === start)
          }), now));
        }
        for (let index=0; index<statements.length; index+=50) await env.DB.batch(statements.slice(index,index+50));
        const existing = await env.DB.prepare("SELECT key FROM app_state WHERE key LIKE 'week:%'").all();
        const extras = (existing.results || []).filter((row) => !weekStarts.has(row.key.slice(5)));
        for (let index=0; index<extras.length; index+=50) {
          await env.DB.batch(extras.slice(index,index+50).map((row)=>env.DB.prepare("DELETE FROM app_state WHERE key = ?").bind(row.key)));
        }
        return json({ ok:true, restoredWeeks:weekStarts.size, updatedAt:now });
      }
      const activeWeek = state.activeWeek;
      if (!activeWeek || !/^\d{4}-\d{2}-\d{2}$/.test(activeWeek)) return json({ error: "저장 주차가 올바르지 않습니다." }, 400);
      const globalValue = JSON.stringify({ items: state.items, weeks: state.weeks });
      const weekValue = JSON.stringify({
        records: state.records.filter((record) => record.weekly_record_id === activeWeek),
        incoming: state.incoming.filter((entry) => entry.weekly_record_id === activeWeek)
      });
      if (globalValue.length > 1_900_000 || weekValue.length > 1_900_000) return json({ error: "저장 자료가 너무 큽니다." }, 413);
      const now = new Date().toISOString();
      const upsert = `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`;
      await env.DB.batch([
        env.DB.prepare(upsert).bind("global", globalValue, now),
        env.DB.prepare(upsert).bind(`week:${activeWeek}`, weekValue, now)
      ]);
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
