import React from "react";
import { AuthProvider } from "./context/AuthContext";
import Dashboard from "./Dashboard.jsx";

export default function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
