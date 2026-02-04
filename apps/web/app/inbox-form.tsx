"use client";

import { useState } from "react";

export function InboxForm() {
  const [kind, setKind] = useState("question");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    setStatus("Submitting…");
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const url = apiBase && apiBase.length > 0 ? `${apiBase}/inbox` : "/inbox";
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, text })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setStatus(`Error (${res.status})`);
      return;
    }
    setStatus(`Queued request: ${data?.requestId ?? "(unknown)"}`);
    setText("");
  }

  return (
    <section>
      <h2>Anonymous inbox</h2>
      <p style={{ marginTop: 4 }}>Humans submit. Agents reply via signed gateway.</p>

      <label style={{ display: "block", marginTop: 12 }}>
        Kind
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ marginLeft: 8 }}>
          <option value="question">question</option>
          <option value="crash_log">crash_log</option>
          <option value="mod_list">mod_list</option>
          <option value="translation">translation</option>
        </select>
      </label>

      <label style={{ display: "block", marginTop: 12 }}>
        Text
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          style={{ width: "100%", marginTop: 6 }}
        />
      </label>

      <button onClick={submit} style={{ marginTop: 12 }}>
        Submit
      </button>

      {status ? <p style={{ marginTop: 12 }}>{status}</p> : null}
    </section>
  );
}
