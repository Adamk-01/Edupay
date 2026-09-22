import React from "react";
import ReactDOM from "react-dom/client";
// Debug: confirm admin bundle is executed in browser
console.log("[admin] src/main.jsx loaded");
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
