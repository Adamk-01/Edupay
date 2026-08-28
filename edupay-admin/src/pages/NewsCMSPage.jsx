// src/pages/NewsCMSPage.jsx
import { useState } from "react";
import { Plus, Send, Edit3, Trash2, Eye } from "lucide-react";
import { useApi }  from "../hooks/index";
import { http }    from "../api/client";
import { Skeleton, StatusChip, PageError, Modal, fmtNum, fmtDate } from "../components/shared";

export default function NewsCMSPage({ toast }) {
  const [tab,         setTab]         = useState("all");
  const [createModal, setCreateModal] = useState(false);
  const [acting,      setActing]      = useState(false);
  const [post, setPost] = useState({
    title: "", excerpt: "", body: "", category: "JAMB",
    author: "EduPay Editorial", read_time: "3 min read",
  });

  const { data, loading, error, refetch } = useApi(() => http.get("/news/?limit=50"));

  const allPosts = data?.posts || [];
  const filtered = tab === "all"
    ? allPosts
    : allPosts.filter(n => tab === "published" ? n.is_published : !n.is_published);

  async function handleCreate(publish = false) {
    if (!post.title || !post.excerpt) { toast("Title and excerpt are required", "error"); return; }
    setActing(true);
    try {
      const r = await http.post("/news/admin/create", post);
      if (publish) await http.patch(`/news/admin/${r.id}/publish`, {});
      toast(publish ? "Post published!" : "Draft saved", "success");
      setCreateModal(false);
      setPost({ title: "", excerpt: "", body: "", category: "JAMB", author: "EduPay Editorial", read_time: "3 min read" });
      refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function handlePublish(p) {
    setActing(true);
    try {
      await http.patch(`/news/admin/${p.id}/publish`, {});
      toast("Post published!", "success"); refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  async function handleDelete(p) {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    setActing(true);
    try {
      await http.delete(`/news/admin/${p.id}`);
      toast("Post deleted", "success"); refetch();
    } catch (e) { toast(e.message, "error"); }
    finally { setActing(false); }
  }

  return (
    <div className="page">
      <div className="section-hdr">
        <div className="section-title">News & Blog CMS</div>
        <button className="btn btn-primary btn-sm" onClick={() => setCreateModal(true)}>
          <Plus size={13}/>New Post
        </button>
      </div>

      <div className="tabs-row">
        {["all","published","draft"].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error ? <PageError msg={error} onRetry={refetch}/> : (
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr><th>Title</th><th>Category</th><th>Author</th><th>Views</th><th>Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {loading
                  ? [1,2,3,4].map(i => <tr key={i}><td colSpan={7}><Skeleton h={14}/></td></tr>)
                  : filtered.length > 0 ? filtered.map(n => (
                    <tr key={n.id}>
                      <td style={{ fontWeight: 600, maxWidth: 260 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                      </td>
                      <td><span className="chip chip-blue">{n.category}</span></td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{n.author}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Eye size={12} color="var(--muted)"/>{fmtNum(n.views)}
                        </div>
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{fmtDate(n.created_at)}</td>
                      <td><StatusChip s={n.is_published ? "published" : "draft"}/></td>
                      <td>
                        <div style={{ display: "flex", gap: 5 }}>
                          {!n.is_published && (
                            <button className="btn btn-success btn-xs" disabled={acting} onClick={() => handlePublish(n)}>
                              <Send size={11}/>Publish
                            </button>
                          )}
                          <button className="btn btn-ghost btn-xs"><Edit3 size={11}/>Edit</button>
                          <button className="btn btn-xs"
                            style={{ background: "var(--red-lt)", color: "var(--red)", border: "none" }}
                            disabled={acting} onClick={() => handleDelete(n)}>
                            <Trash2 size={11}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                  : <tr><td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--muted)" }}>No posts found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={createModal} onClose={() => setCreateModal(false)}
        title="Create New Post" sub="Write and publish an educational article"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCreateModal(false)}>Cancel</button>
            <button className="btn btn-outline" disabled={acting} onClick={() => handleCreate(false)}>
              {acting ? "Saving…" : "Save Draft"}
            </button>
            <button className="btn btn-primary" disabled={acting} onClick={() => handleCreate(true)}>
              {acting ? "Publishing…" : "Publish Now"}
            </button>
          </>
        }>
        <div className="form-group">
          <label className="form-label">Title *</label>
          <input className="form-input" placeholder="Article title…"
            value={post.title} onChange={e => setPost({ ...post, title: e.target.value })}/>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={post.category} onChange={e => setPost({ ...post, category: e.target.value })}>
              {["JAMB","WAEC","NECO","Admission","Scholarship","Study Tips","University Life"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Author</label>
            <input className="form-input" value={post.author} onChange={e => setPost({ ...post, author: e.target.value })}/>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Excerpt * <span style={{ color: "var(--muted)", fontWeight: 400 }}>(shown on listing)</span></label>
          <textarea className="form-textarea" rows={2} placeholder="Short summary…"
            value={post.excerpt} onChange={e => setPost({ ...post, excerpt: e.target.value })}/>
        </div>
        <div className="form-group">
          <label className="form-label">Full Body</label>
          <textarea className="form-textarea" rows={6} placeholder="Full article content…"
            value={post.body} onChange={e => setPost({ ...post, body: e.target.value })}/>
        </div>
        <div className="form-group">
          <label className="form-label">Read Time</label>
          <input className="form-input" placeholder="3 min read"
            value={post.read_time} onChange={e => setPost({ ...post, read_time: e.target.value })}/>
        </div>
      </Modal>
    </div>
  );
}
