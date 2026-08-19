// src/pages/ConsultationPage.jsx
import { useState, useEffect } from "react";
import { GraduationCap, Star, Calendar, CheckCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { useApi }            from "../hooks/index";
import { walletApi }         from "../api/wallet";
import { consultationApi }   from "../api/services";
import { Skeleton, fmt, fmtDate } from "../components/shared";

const TOPICS = [
  "JAMB Registration Help","Post-UTME Preparation","School Form Guidance",
  "Course Selection","Scholarship Applications","Direct Entry","Study Abroad",
];

export default function ConsultationPage({ toast }) {
  const [selected, setSelected] = useState(null);
  const [date,     setDate]     = useState("");
  const [time,     setTime]     = useState("");
  const [topic,    setTopic]    = useState("");
  const [notes,    setNotes]    = useState("");
  const [booking,  setBooking]  = useState(false);
  const [booked,   setBooked]   = useState(false);
  const [slots,    setSlots]    = useState([]);

  const { data: walletData }                     = useApi(() => walletApi.getWallet());
  const { data: cData, loading, error, refetch } = useApi(() => consultationApi.listConsultants());
  const { data: sesData, refetch: refetchSes }   = useApi(() => consultationApi.getMySessions());

  const consultants = cData?.consultants || [];
  const sessions    = sesData?.sessions  || [];

  useEffect(() => {
    if (!date || !selected) return;
    consultationApi.getAvailability(selected.id, date)
      .then(d => setSlots(d.available_slots || []))
      .catch(() => setSlots(["9:00 AM","10:00 AM","11:00 AM","12:00 PM","2:00 PM","3:00 PM","4:00 PM"]));
  }, [date, selected?.id]);

  async function handleBook() {
    if (!date || !time || !topic) { toast("Please fill all fields", "error"); return; }
    if (Number(walletData?.balance || 0) < Number(selected.price_per_session))
      { toast("Insufficient wallet balance", "error"); return; }
    setBooking(true);
    try {
      await consultationApi.bookSession({ consultant_id: selected.id, topic, scheduled_date: date, scheduled_time: time, notes });
      setBooked(true);
      refetchSes();
      toast(`Session booked with ${selected.full_name}!`, "success");
    } catch (e) {
      toast(e.message || "Booking failed", "error");
    } finally { setBooking(false); }
  }

  if (booked) return (
    <div className="page">
      <div style={{ maxWidth: 460, margin: "40px auto", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, background: "var(--green-light)", borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <CheckCircle size={36} color="var(--green)"/>
        </div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 8 }}>Session Confirmed!</div>
        <div style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 24, lineHeight: 1.75 }}>
          Your session with <strong>{selected?.full_name}</strong> on <strong>{date}</strong> at <strong>{time}</strong> is confirmed.
        </div>
        <button className="btn btn-primary btn-full"
          onClick={() => { setSelected(null); setBooked(false); setDate(""); setTime(""); setTopic(""); setNotes(""); }}>
          Back to Consultants
        </button>
      </div>
    </div>
  );

  if (selected) return (
    <div className="page">
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 18 }} onClick={() => setSelected(null)}>
        <ArrowLeft size={14}/>Back
      </button>
      <div style={{ maxWidth: 520 }}>
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, background: selected.avatar_color || "var(--blue)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: "#fff", flexShrink: 0 }}>
              {selected.initials}
            </div>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15 }}>{selected.full_name}</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{selected.role}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 12, fontWeight: 600, color: "var(--amber)" }}>
                <Star size={12} fill="var(--amber)"/>{selected.rating} · {selected.total_sessions} sessions
              </div>
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom: 18 }}>Schedule Your Session</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Preferred Date</label>
              <input className="form-input" type="date" min={new Date().toISOString().split("T")[0]}
                value={date} onChange={e => { setDate(e.target.value); setTime(""); }}/>
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Time</label>
              {date && slots.length > 0
                ? <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {slots.map(s => (
                      <button key={s} onClick={() => setTime(s)}
                        style={{ padding: "7px 13px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          background: time === s ? "var(--blue)" : "var(--bg)",
                          color: time === s ? "#fff" : "var(--muted)",
                          border: `1.5px solid ${time === s ? "var(--blue)" : "var(--border)"}` }}>
                        {s}
                      </button>
                    ))}
                  </div>
                : <div style={{ fontSize: 13, color: "var(--muted)", paddingTop: 10 }}>
                    {date ? "No slots available" : "Select a date first"}
                  </div>}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Topic</label>
            <select className="form-select" value={topic} onChange={e => setTopic(e.target.value)}>
              <option value="">Select topic</option>
              {TOPICS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Additional Notes <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span></label>
            <textarea className="form-textarea" placeholder="Describe what you need help with…"
              value={notes} onChange={e => setNotes(e.target.value)}/>
          </div>
          <div style={{ background: "var(--bg)", borderRadius: 10, padding: "13px 15px", marginBottom: 16 }}>
            <div className="summary-row"><span className="summary-key">Session fee</span><span style={{ fontWeight: 700, color: "var(--blue)" }}>₦{fmt(selected.price_per_session)} / session</span></div>
            <div className="summary-row" style={{ borderBottom: "none" }}><span className="summary-key">Duration</span><span className="summary-val">{selected.duration_minutes || 60} minutes</span></div>
          </div>
          <button className="btn btn-primary btn-full" onClick={handleBook} disabled={booking}>
            {booking
              ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }}/>Booking…</>
              : <><CheckCircle size={15}/>Confirm & Pay ₦{fmt(selected.price_per_session)}</>}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div style={{ background: "var(--blue-light)", border: "1.5px solid #BFDBFE", borderRadius: 12, padding: "15px 18px", marginBottom: 22, display: "flex", alignItems: "center", gap: 12 }}>
        <GraduationCap size={20} color="var(--blue)"/>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: "var(--blue)" }}>Book a 1-on-1 Educational Consultation</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>Connect with certified consultants for JAMB, admissions, scholarships, and career guidance.</div>
        </div>
      </div>

      {loading
        ? <div className="consult-grid">{[1,2,3].map(i => <div key={i} className="card" style={{ padding: 20 }}><Skeleton h={52} w={52}/><div style={{ marginTop: 12 }}><Skeleton h={16} mb={6}/><Skeleton h={12} w="70%"/></div></div>)}</div>
        : error
          ? <div className="empty-state"><p style={{ color: "var(--red)", marginBottom: 8 }}>{error}</p><button className="btn btn-ghost btn-sm" onClick={refetch}>Retry</button></div>
          : consultants.length > 0
            ? <div className="consult-grid">
                {consultants.map(c => (
                  <div key={c.id} className="consult-card">
                    <div className="consult-av" style={{ background: c.avatar_color || "var(--blue)" }}>{c.initials}</div>
                    <div className="consult-name">{c.full_name}</div>
                    <div className="consult-role">{c.role}</div>
                    <div className="tag-row">
                      {(c.specialties || "").split(",").map(t => <span key={t} className="tag">{t.trim()}</span>)}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--amber)", marginBottom: 6 }}>
                      <Star size={13} fill="var(--amber)"/>{c.rating} · {c.total_sessions} sessions
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, color: "var(--blue)", fontSize: 13 }}>₦{fmt(c.price_per_session)} / session</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.status === "active" ? "var(--green)" : "var(--muted)" }}/>
                        <span style={{ color: c.status === "active" ? "var(--green)" : "var(--muted)" }}>
                          {c.status === "active" ? "Available" : "Unavailable"}
                        </span>
                      </div>
                    </div>
                    <button className={`btn btn-sm btn-full ${c.status === "active" ? "btn-primary" : "btn-ghost"}`}
                      disabled={c.status !== "active"}
                      onClick={() => c.status === "active" && setSelected(c)}>
                      {c.status === "active" ? <><Calendar size={13}/>Book Session</> : "Unavailable"}
                    </button>
                  </div>
                ))}
              </div>
            : <div className="empty-state"><div className="empty-icon"><GraduationCap size={22} color="var(--muted)"/></div><p>No consultants available yet</p></div>}

      <div className="card card-pad" style={{ marginTop: 4 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>My Upcoming Sessions</div>
        {sessions.filter(s => s.status === "confirmed").length > 0
          ? <div className="tx-list">
              {sessions.filter(s => s.status === "confirmed").map(s => (
                <div key={s.id} className="tx-row">
                  <div className="tx-icon-wrap" style={{ background: "var(--blue-light)" }}><Calendar size={16} color="var(--blue)"/></div>
                  <div style={{ flex: 1 }}><div className="tx-name">{s.topic}</div><div className="tx-time">{s.scheduled_date} at {s.scheduled_time}</div></div>
                </div>
              ))}
            </div>
          : <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-icon"><Calendar size={22} color="var(--muted)"/></div>
              <p>No upcoming sessions. Book one above.</p>
            </div>}
      </div>
    </div>
  );
}
