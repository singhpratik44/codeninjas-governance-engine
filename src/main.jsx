import React from "react";
import { createRoot } from "react-dom/client";
import Engine from "./Engine.tsx";

// Deep-linking: if the page loads with a hash (e.g. #risk from a shared
// link), start on that tab. Falsy/empty hash falls through to Engine's own
// default ("quantum"). No validation against a known tab list here — an
// invalid hash just shows a blank content pane with the sidebar intact,
// recoverable with one click; not worth the added complexity of importing
// or duplicating Engine's internal tab list just to guard a rare typo.
const initialTab = window.location.hash ? window.location.hash.slice(1) : undefined;

const root = createRoot(document.getElementById("root"));
root.render(<Engine initialTab={initialTab} />);
