Intent — Product Requirements Document (v2.0)
1. Vision & North Star
The Digital Sanctuary: We are moving away from cold, clinical utility toward a space that feels like a sun-drenched physical studio—a place of reflection, focus, and warmth. Intent is no longer just a capture tool; it is a journaling and reflection system that records why something mattered in a premium, editorial-inspired environment.

2. The Digital Sanctuary Design System
This version adopts a strict design specification to ensure the UI feels welcoming and organic.

2.1 Surface & Depth (The "No-Line" Rule)
Boundaries: 1px solid borders for sectioning are strictly prohibited. Regional containment must be achieved solely through background color shifts (e.g., #fdf9f5 for primary surfaces and #f7f3ef for secondary regions).

Layering: Hierarchy is created by "stacking" surface tiers (e.g., white cards on a tonal background) to mimic physical paper on a desk.

Mica Effect: The Windows Fluent Mica effect is elevated with semi-transparent layers and a backdrop-blur of 20px–40px for floating elements.

2.2 Typography (The Editorial Voice)
Serif (Noto Serif): Used for displays, headlines, and titles to provide a high-end, breathy feel.

Sans-Serif (Manrope): Used for functional UI, labels, and body text to ensure legibility and a geometric but soft feel.

2.3 Interactions (The "Glow")
Radial Highlight: Hovering over primary elements triggers a subtle radial gradient highlight that follows the cursor, mimicking soft light moving across a physical surface.

3. Architecture: Dual-Platform System
3.1 The Capture Layer (Chrome Extension)
Mindful Capture: A streamlined popup featuring a large "Drop a thought..." textarea for manual intent entry.

Contextual Toggles: A dedicated "+ link" toggle to optionally attach the current URL and page title to any capture.

Distillation Feedback: During LLM inference, the UI displays a "Distilling context..." state with subtle progress animations.

3.2 The Reflection Layer (Web Application)
Navigation Rail: A sidebar using the Mica effect, organizing the sanctuary into Feed, Reflections, Library, and Archive.

Asymmetric Feed: An editorial-style grid with varied card heights and offset margins to create a breathable, "journal" layout.

Deep Detail View: A full-page layout for deep reading, including:

Distillation: An AI-generated bulleted summary of core facts.

Research Metadata: Original source URL, capture date, and conceptual tags (e.g., #design-theory, #focus).

Prose Body: A distraction-free canvas for reading the full extracted text.

4. Updated User Stories
US-12 (Distillation): As a user, I want the system to distill long articles into three core bullet points so I can recall the essence without re-reading.

US-13 (Editorial Feel): As a user, I want to see my saves in an asymmetric grid so that my digital library feels like a curated magazine rather than a list.

US-14 (Conceptual Sync): As a user, I want my captures to sync from my extension to my web dashboard automatically so I can reflect on a larger screen.

5. Technical Requirements & Roadmap
5.1 Sync & Storage
Requirement: Transition from chrome.storage.local to a synced backend (or local-first sync protocol) to support the dual-platform architecture.

Privacy: All API keys and settings continue to be stored locally in chrome.storage.sync.

5.2 Updated Roadmap
Phase 1: Visual Sanctuary (Current): Overhaul the Extension UI and implement the "Digital Sanctuary" color palette and typography.

Phase 2: Companion Dashboard: Build the full web application with the asymmetric grid and Detail views.

Phase 3: Research Mode: Implement direct export to Markdown for external vaults (Obsidian), including intent metadata and AI distillations.