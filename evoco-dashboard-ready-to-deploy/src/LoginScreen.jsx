import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";

const C = {
  bg: "#141414",
  bgCard: "#1e1e1e",
  amber: "#f2a91f",
  white: "#ffffff",
  grey: "#9a9a9a",
  border: "#2c2c2c",
  error: "#e0736d",
};

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError("Login failed. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <form onSubmit={handleSubmit} style={{ width: 360, background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ color: C.white, fontSize: 26, fontWeight: 800, letterSpacing: 1 }}>EVO</span>
          <span style={{ color: C.amber, fontSize: 26, fontWeight: 800, letterSpacing: 1 }}>·CO</span>
          <div style={{ color: C.grey, fontSize: 12.5, marginTop: 6 }}>Manager Dashboard</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ color: C.grey, fontSize: 11, marginBottom: 6 }}>Email</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="andre@evoco.co.nz"
            style={{ width: "100%", boxSizing: "border-box", background: "#141414", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.white, fontSize: 13.5 }}
          />
        </div>

        <div style={{ marginBottom: error ? 10 : 22 }}>
          <div style={{ color: C.grey, fontSize: 11, marginBottom: 6 }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ width: "100%", boxSizing: "border-box", background: "#141414", border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", color: C.white, fontSize: 13.5 }}
          />
        </div>

        {error && <div style={{ color: C.error, fontSize: 12.5, marginBottom: 16 }}>{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", background: C.amber, color: "#1a1400", border: "none", borderRadius: 8, padding: "12px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
