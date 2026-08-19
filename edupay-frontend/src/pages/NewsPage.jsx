// src/pages/NewsPage.jsx
import { useState } from "react";
import { Search, Filter, BookOpen, Calendar, Clock, ArrowLeft } from "lucide-react";
import { useApi }  from "../hooks/index";
import { newsApi } from "../api/services";
import { Skeleton, fmtDate } from "../components/shared";

const TAG_COLORS = {
  JAMB:       ["#EBF2FF","#1A56DB"],
  WAEC:       ["#FEF3C7","#92400E"],
  NECO:       ["#D1FAE5","#065F46"],
  Admission:  ["#D1FAE5","#065F46"],
  Scholarship:["#F5F3FF","#5B21B6"],
  default:    ["#EBF2FF","#1A56DB"],
};

const CATS = ["All","JAMB","WAEC","NECO","Admission","Scholarship","Study Tips"];

export default function NewsPage() {
  const [selected, setSelected] = useState(null);
  const [search,   setSearch]   = useState("");
  const [category, setCategory] = useState("");

  const { data, loading, error, refetch } = useApi(() => {
    const p = new URLSearchParams();
    if (search)   p.append("search",   search);
    if (category) p.append("category", category);
    return newsApi.getPosts({ search, category });
  }, [search, category]);

  const posts = data?.posts || [];

  if (selected) {
    const [tagBg, tagColor] = TAG_COLORS[selected.category] || TAG_COLORS.default;
    return (
      <div className="page">
        <button className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }} onClick={() => setSelected(null)}>
          <ArrowLeft size={14}/>Back to News
        </button>
        <div style={{ maxWidth: 680 }}>
          <div style={{ height: 180, background: tagBg, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
            <BookOpen size={52} color={tagColor}/>
          </div>
          <span className="blog-tag" style={{ background: tagBg, color: tagColor }}>{selected.category}</span>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 800, margin: "12px 0 10px", lineHeight: 1.3 }}>{selected.title}</h1>
          <div style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 24, display: "flex", alignItems: "center", gap: 10 }}>
            <Calendar size={12}/>{fmtDate(selected.created_at)}
            <span>·</span>
            <Clock size={12}/>{selected.read_time || "3 min read"}
          </div>
          <div style={{ lineHeight: 1.85, fontSize: 14.5, color: "var(--text-2)" }}
            dangerouslySetInnerHTML={{ __html: selected.body?.replace(/\n/g, "<br/>") || selected.excerpt }}/>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div className="input-with-icon" style={{ flex: 1 }}>
          <Search size={15}/>
          <input className="form-input" placeholder="Search articles…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <button className="btn btn-ghost"><Filter size={14}/>Filter</button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {CATS.map(c => (
          <span key={c} className="chip"
            style={{ cursor: "pointer", padding: "6px 13px", fontSize: 12,
              background: (category === c || (c === "All" && !category)) ? "var(--blue)" : "var(--blue-light)",
              color:      (category === c || (c === "All" && !category)) ? "#fff" : "var(--blue)" }}
            onClick={() => setCategory(c === "All" ? "" : c)}>
            {c}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="blog-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="card" style={{ overflow: "hidden" }}>
              <Skeleton h={136}/>
              <div style={{ padding: 16 }}><Skeleton h={12} w="60%" mb={8}/><Skeleton h={18} mb={6}/><Skeleton h={12}/></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty-state">
          <p style={{ color: "var(--red)", marginBottom: 8 }}>{error}</p>
          <button className="btn btn-ghost btn-sm" onClick={refetch}>Retry</button>
        </div>
      ) : posts.length > 0 ? (
        <div className="blog-grid">
          {posts.map(p => {
            const [tagBg, tagColor] = TAG_COLORS[p.category] || TAG_COLORS.default;
            return (
              <div key={p.id} className="blog-card" onClick={() => setSelected(p)}>
                <div className="blog-img-wrap" style={{ background: tagBg }}>
                  <BookOpen size={48} color={tagColor}/>
                </div>
                <div className="blog-body">
                  <span className="blog-tag" style={{ background: tagBg, color: tagColor }}>{p.category}</span>
                  <div className="blog-title">{p.title}</div>
                  <div className="blog-excerpt">{p.excerpt}</div>
                  <div className="blog-meta">
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={10}/>{fmtDate(p.created_at)}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={10}/>{p.read_time || "3 min read"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon"><BookOpen size={22} color="var(--muted)"/></div>
          <p>No articles published yet</p>
        </div>
      )}
    </div>
  );
}
