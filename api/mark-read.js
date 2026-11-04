// Vercel serverless function: records that the user opened/read a wiki item.
// Writes an append-only entry to `_ops/world_intel/read_log.json` in the
// GitHub repo via the Contents API, so the next cron cycle (sync_read_log.py)
// can pull it down and stamp `read: true` on the matching wiki frontmatter.
//
// Requires one Vercel environment variable: GH_PAT
//   A GitHub fine-grained or classic PAT with "Contents: Read and write"
//   access to EvanLee70/world-intel-board. Add it in:
//   Vercel dashboard -> world-intel-board project -> Settings -> Environment
//   Variables -> GH_PAT (all environments), then redeploy once.
//
// Without GH_PAT set, this function no-ops (returns 200 but logs a warning)
// so a missing token never breaks the dashboard for the user.

const OWNER = "EvanLee70";
const REPO = "world-intel-board";
const PATH = "_ops/world_intel/read_log.json";
const BRANCH = "main";

function safeId(raw) {
  if (typeof raw !== "string") return null;
  const id = raw.trim().slice(0, 200);
  return /^[a-zA-Z0-9_\-.]+$/.test(id) ? id : null;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const rawId = (req.query && req.query.id) || (req.body && req.body.id);
  const id = safeId(rawId);
  if (!id) {
    res.status(400).json({ ok: false, error: "missing or invalid id" });
    return;
  }

  const token = process.env.GH_PAT;
  if (!token) {
    console.warn("mark-read: GH_PAT not configured, skipping write");
    res.status(200).json({ ok: true, recorded: false, reason: "no GH_PAT configured" });
    return;
  }

  const apiBase = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "world-intel-board-mark-read",
  };

  try {
    let sha = null;
    let entries = [];
    const getResp = await fetch(`${apiBase}?ref=${BRANCH}`, { headers });
    if (getResp.status === 200) {
      const data = await getResp.json();
      sha = data.sha;
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      try {
        entries = JSON.parse(decoded);
        if (!Array.isArray(entries)) entries = [];
      } catch {
        entries = [];
      }
    } else if (getResp.status !== 404) {
      const errText = await getResp.text();
      console.error("mark-read: GET failed", getResp.status, errText);
    }

    if (!entries.some((e) => e.id === id)) {
      entries.push({ id, ts: new Date().toISOString() });
    }

    const body = {
      message: `read: mark ${id} as read`,
      content: Buffer.from(JSON.stringify(entries, null, 2), "utf-8").toString("base64"),
      branch: BRANCH,
    };
    if (sha) body.sha = sha;

    const putResp = await fetch(apiBase, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (putResp.status >= 200 && putResp.status < 300) {
      res.status(200).json({ ok: true, recorded: true });
    } else {
      const errText = await putResp.text();
      console.error("mark-read: PUT failed", putResp.status, errText);
      res.status(200).json({ ok: true, recorded: false, reason: "github write failed" });
    }
  } catch (err) {
    console.error("mark-read: unexpected error", err);
    res.status(200).json({ ok: true, recorded: false, reason: "exception" });
  }
};
