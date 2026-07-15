import React from "react";
import { createRoot } from "react-dom/client";
import Engine from "./Engine.tsx";

const root = createRoot(document.getElementById("root"));
root.render(<Engine />);
