import React, { useState } from "react";

const COLORS = {
  root:        { bg: "#0a1628", border: "#38bdf8", text: "#f8fafc",   accent: "#38bdf8" },
  gm:          { bg: "#0f2039", border: "#0ea5e9", text: "#bae6fd",   accent: "#0ea5e9" },
  dmm:         { bg: "#12103a", border: "#818cf8", text: "#e0e7ff",   accent: "#818cf8" },
  neonlights:  { bg: "#1c1400", border: "#fbbf24", text: "#fef9c3",   accent: "#fbbf24" },
  helpier:     { bg: "#001a0d", border: "#10b981", text: "#d1fae5",   accent: "#10b981" },
  hostelpups:  { bg: "#110820", border: "#a78bfa", text: "#ede9fe",   accent: "#a78bfa" },
  hailaglobal: { bg: "#1a0a00", border: "#f97316", text: "#ffedd5",   accent: "#f97316" },
  travelpups:  { bg: "#001a19", border: "#2dd4bf", text: "#ccfbf1",   accent: "#2dd4bf" },
  magazine:    { bg: "#1c1000", border: "#fcd34d", text: "#fef3c7",   accent: "#fcd34d" },
  role:        { bg: "#0d1b2a", border: "#334155", text: "#94a3b8",   accent: "#cbd5e1" },
};

type CK = keyof typeof COLORS;

function Box({
  title, sub, icon, ck, badge, sm,
}: {
  title: string; sub?: string; icon?: string; ck: CK; badge?: string; sm?: boolean;
}) {
  const c = COLORS[ck];
  return (
    <div style={{
      background: c.bg, border: `2px solid ${c.border}`, borderRadius: sm ? 8 : 12,
      padding: sm ? "8px 12px" : "14px 18px", minWidth: sm ? 120 : 160, maxWidth: sm ? 155 : 205,
      textAlign: "center", boxShadow: `0 0 18px ${c.border}28`, position: "relative",
    }}>
      {badge && (
        <span style={{
          position: "absolute", top: -10, right: -10, background: c.accent,
          color: "#000", borderRadius: 20, fontSize: 10, fontWeight: 800,
          padding: "2px 7px", letterSpacing: 0.5,
        }}>{badge}</span>
      )}
      {icon && <div style={{ fontSize: sm ? 16 : 22, marginBottom: 3 }}>{icon}</div>}
      <div style={{ color: c.accent, fontWeight: 700, fontSize: sm ? 10.5 : 12.5, letterSpacing: 0.3, lineHeight: 1.3 }}>
        {title}
      </div>
      {sub && <div style={{ color: c.text, fontSize: sm ? 9 : 10, marginTop: 3, opacity: 0.7, lineHeight: 1.3 }}>{sub}</div>}
    </div>
  );
}

function VLine({ color = "#1e3a5f", h = 24 }: { color?: string; h?: number }) {
  return <div style={{ width: 2, height: h, background: color, margin: "0 auto" }} />;
}

function Company({
  name, ck, icon, roles, magazines,
}: {
  name: string; ck: CK; icon: string;
  roles: { title: string; sub?: string; icon?: string; badge?: string }[];
  magazines?: string[];
}) {
  const [open, setOpen] = useState(true);
  const c = COLORS[ck];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: magazines ? 270 : 190 }}>
      <VLine color={c.border} h={30} />
      <div style={{ cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
        <Box title={name} icon={icon} ck={ck} badge={open ? "▲" : "▼"} />
      </div>

      {open && (
        <>
          {/* roles */}
          <VLine color={c.border} h={18} />
          <div style={{ display: "flex", gap: 12, position: "relative" }}>
            {roles.length > 1 && (
              <div style={{
                position: "absolute", top: 0, left: "18%", right: "18%",
                height: 2, background: c.border + "88",
              }} />
            )}
            {roles.map((r, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {roles.length > 1 && <VLine color={c.border + "88"} h={14} />}
                <Box title={r.title} sub={r.sub} icon={r.icon} ck="role" badge={r.badge} sm />
              </div>
            ))}
          </div>

          {/* magazines */}
          {magazines && (
            <>
              <VLine color={c.border} h={18} />
              <div style={{
                border: `1.5px dashed ${c.border}88`, borderRadius: 10,
                padding: "10px 14px", background: "#110800", minWidth: 248,
              }}>
                <div style={{
                  color: COLORS.magazine.accent, fontSize: 10, fontWeight: 800,
                  textAlign: "center", marginBottom: 8, letterSpacing: 1.5,
                }}>
                  📰 SUB DIGITAL MAGAZINES
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                  {magazines.map((m, i) => (
                    <div key={i} style={{
                      background: COLORS.magazine.bg, border: `1.5px solid ${COLORS.magazine.border}`,
                      borderRadius: 6, padding: "4px 10px", color: COLORS.magazine.accent,
                      fontSize: 10, fontWeight: 700, boxShadow: `0 0 8px ${COLORS.magazine.border}33`,
                    }}>{m}</div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function App() {
  const companies = [
    {
      name: "Neonlights Pvt Ltd", ck: "neonlights" as CK, icon: "💡",
      roles: [
        { title: "Mktg Manager", sub: "& Content Creator", icon: "📣" },
        { title: "Sales Exec", icon: "💼", badge: "×2" },
      ],
    },
    {
      name: "Helpier Pvt Ltd", ck: "helpier" as CK, icon: "🤝",
      roles: [
        { title: "Mktg Manager", sub: "& Content Creator", icon: "📣" },
        { title: "Sales Exec", icon: "💼", badge: "×2" },
      ],
    },
    {
      name: "Hostelpups Pvt Ltd", ck: "hostelpups" as CK, icon: "🏠",
      roles: [
        { title: "Content Creator", icon: "🎨" },
        { title: "Sales Exec", icon: "💼" },
      ],
    },
    {
      name: "Hailaglobal Pvt Ltd", ck: "hailaglobal" as CK, icon: "🌐",
      roles: [
        { title: "Content Creator", icon: "🎨" },
        { title: "Sales Exec", icon: "💼" },
      ],
      magazines: ["Haila Kochi", "Haila Bengaluru", "Haila Mumbai", "Haila Hyderabad", "Haila Gurgaon"],
    },
    {
      name: "Travelpups Pvt Ltd", ck: "travelpups" as CK, icon: "✈️",
      roles: [
        { title: "Content Creator", icon: "🎨" },
        { title: "Sales Exec", icon: "💼" },
      ],
    },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#04090f",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: "36px 32px 80px", overflowX: "auto",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div style={{ color: "#38bdf8", fontSize: 10, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 6 }}>
          Organisational Chart · 2026
        </div>
        <div style={{ color: "#f8fafc", fontSize: 26, fontWeight: 900, letterSpacing: 0.3 }}>
          Webstreax Global Private Ltd
        </div>
        <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>
          Corporate Structure — All Subsidiaries &amp; Teams
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>

        {/* Root */}
        <div style={{ marginTop: 20 }}>
          <Box title="WEBSTREAX GLOBAL PVT LTD" sub="Parent Company" icon="🏢" ck="root" />
        </div>

        <VLine color="#1e3a5f" h={28} />

        {/* GM + DMM */}
        <div style={{ display: "flex", gap: 56, position: "relative", alignItems: "flex-start" }}>
          <div style={{
            position: "absolute", top: 0, left: "20%", right: "20%",
            height: 2, background: "#1e3a5f",
          }} />
          {[
            { title: "General Manager", sub: "Sales · Marketing · Finance\n(all companies)", icon: "👔", ck: "gm" as CK, border: COLORS.gm.border },
            { title: "Digital Marketing Manager", sub: "All Socials & Websites", icon: "📱", ck: "dmm" as CK, border: COLORS.dmm.border },
          ].map((n, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <VLine color={n.border} h={20} />
              <Box title={n.title} sub={n.sub} icon={n.icon} ck={n.ck} />
            </div>
          ))}
        </div>

        <VLine color="#1e3a5f" h={36} />

        {/* Subsidiaries label */}
        <div style={{
          color: "#334155", fontSize: 9, fontWeight: 800, letterSpacing: 3,
          textTransform: "uppercase", marginBottom: 0,
        }}>
          Subsidiaries
        </div>

        {/* Horizontal spine */}
        <div style={{ position: "relative", paddingTop: 0 }}>
          <div style={{
            position: "absolute", top: 0, left: "8%", right: "8%",
            height: 2, background: "#1e3a5f",
          }} />
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            {companies.map((co, i) => (
              <Company key={i} {...co} />
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 52, borderTop: "1px solid #0f1e2e", paddingTop: 18,
        display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center",
      }}>
        {[
          { label: "Neonlights", c: COLORS.neonlights.border },
          { label: "Helpier", c: COLORS.helpier.border },
          { label: "Hostelpups", c: COLORS.hostelpups.border },
          { label: "Hailaglobal", c: COLORS.hailaglobal.border },
          { label: "Travelpups", c: COLORS.travelpups.border },
          { label: "Digital Magazines", c: COLORS.magazine.border },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 11, height: 11, borderRadius: 3, background: l.c, boxShadow: `0 0 7px ${l.c}` }} />
            <span style={{ color: "#64748b", fontSize: 11 }}>{l.label}</span>
          </div>
        ))}
        <span style={{ color: "#1e3a5f", fontSize: 11, marginLeft: 6 }}>· Click company cards to collapse</span>
      </div>
    </div>
  );
}
