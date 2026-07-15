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

// Build marker: injected at build time via esbuild --define, set to the
// triggering commit's SHA. This exists specifically so the deploy workflow
// can verify its own output — grep the freshly-built bundle for this exact
// commit's SHA and fail loudly if it's missing, instead of silently
// "succeeding" while actually shipping stale content. A generic string
// marker isn't reliable for this (proven the hard way: two markers used
// earlier both coincidentally already existed in the codebase for unrelated
// reasons); a commit SHA is guaranteed unique per build by construction.
// eslint-disable-next-line no-undef
window.__BUILD_SHA__ = typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "dev";

const root = createRoot(document.getElementById("root"));
root.render(<Engine initialTab={initialTab} />);
