function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function onRequestPost(context) {
  if (!context.env.EDIT_PIN) return json({ error: "EDIT_PIN이 설정되지 않았습니다." }, 503);
  const supplied = context.request.headers.get("x-edit-pin");
  if (!supplied || supplied !== context.env.EDIT_PIN) return json({ error: "비밀번호가 맞지 않습니다." }, 401);
  return json({ ok: true });
}
