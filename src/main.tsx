import "viem/window";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.ethereum ? <App /> : <span className="text-error font-bold">You need to install a browser wallet</span>}
  </StrictMode>,
);
