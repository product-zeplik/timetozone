# TimeToZone — Complete Brand & Product Identity Brief
**Version 1.0 · 03 November 2026 · Approved direction: TZ Transformation**

## 1. Executive direction
TimeToZone is a conversion-first time-zone utility. Its identity must communicate precision, speed, global usefulness and clarity without looking like a generic world-clock, calendar or meeting app. The selected logo direction is **TZ Transformation**: a bold geometric monogram that makes the initials T and Z one compact, ownable signature.

**Brand line:** Time, translated.  
**Supporting line:** From any time to any zone.  
**Brand promise:** The right time, in every zone.

## 2. Logo decision and rationale
### Selected concept: The TZ Mark
The symbol is built from two custom geometric letterforms: T on the left and Z on the right. They share a common visual rhythm, similar weight and aligned top/bottom boundaries. The mark is intentionally flat, high-contrast and compact.

**Meaning**
- T = Time.
- Z = Zone.
- The paired monogram expresses the movement from a time value to a destination zone.
- Its simple silhouette is designed to remain recognizable at favicon and extension-icon sizes.

**Why this direction**
- It is directly tied to the name, not an arbitrary abstract glyph.
- It can stand alone without the wordmark.
- It works in one colour and reverses cleanly between light and dark themes.
- It avoids literal clocks, globe grids, map pins, flags and decorative orbit rings.

**Design rule:** The TZ monogram in the supplied SVG files is the master source. Do not redraw it by eye, replace it with a font glyph, add an orbit, add gradients, or modify its proportions.

### Logo configurations
1. Primary horizontal lockup — use in website header, footer, docs and brand placements.
2. Stacked lockup — use only where a vertical composition is needed.
3. Standalone mark — favicon, Chrome extension, app icon, avatar and compact UI.
4. Reverse lockup — white artwork on near-black surfaces.
5. App icon — monogram centered within a rounded-square container; platform masks may crop corners.

### Clear space and minimum sizes
- Maintain clear space around the full logo equal to at least 0.5× the symbol height.
- Never allow controls, text, borders or images into this clear-space zone.
- Horizontal lockup: recommended minimum 140 px wide on screen.
- Standalone mark: 20 px preferred in UI; 16 px only for favicon/browser contexts.
- Do not use the stacked lockup below 100 px wide.
- Preserve SVG aspect ratio; never stretch or skew.

## 3. Logo usage
**Correct**
- Black mark/wordmark on white or very light surfaces.
- White mark/wordmark on #080808 or black surfaces.
- Standalone mark when the full wordmark would become too small.
- Use SVG as the primary asset format.

**Incorrect**
- No gradients, bevels, shadows, glows, strokes or 3D effects.
- No non-monochrome logo variants.
- No outline-only version.
- No rotation, skewing, compression or stretching.
- No placing the mark inside a literal clock, globe or map pin.
- No additional orbit line; it weakens the direct TZ meaning and harms small-size clarity.
- Do not change the wordmark spelling or letter case: always `TimeToZone`.

## 4. Colour system
The identity is strictly monochrome. Meaning and hierarchy come from contrast, typography, spacing and shape—not accent colours.

### Light theme
- Canvas: #FFFFFF
- Surface: #F7F7F7
- Raised surface: #FFFFFF
- Primary text: #080808
- Secondary text: #5F6368
- Border: #E5E5E5
- Focus ring: #080808

### Dark theme
- Canvas: #080808
- Surface: #121212
- Raised surface: #191919
- Primary text: #F7F7F7
- Secondary text: #A6A6A6
- Border: #292929
- Focus ring: #FFFFFF

Do not use gray for small critical text unless contrast is sufficient. Do not use colour alone for DST changes, errors, date rollover or selected states.

## 5. Typography
- Interface: Geist Sans; fallback Arial/Helvetica/sans-serif.
- Numeric/time values: Geist Mono; fallback system monospace.
- Use tabular numerals for times so live values do not shift horizontally.
- Display: 40–56 px, bold.
- H1: 32–40 px, bold.
- H2: 22–28 px, semibold.
- Body: 15–17 px, regular.
- UI labels: 12–14 px, medium/semibold.
- Primary converted time: 32–48 px, Geist Mono, medium/semibold.
- UTC offsets and zone identifiers: 12–14 px, Geist Mono.

## 6. Brand personality and voice
**Personality:** precise, calm, direct, globally useful, quietly confident.

**Do**
- Answer first.
- Use plain language.
- State dates and date rollovers clearly.
- Explain DST only when it affects the result.
- Be exact and transparent.

**Don't**
- Use hype, unnecessary exclamation marks or fake urgency.
- Claim atomic-clock accuracy unless implemented and verified.
- Use vague labels such as “magic time” or “perfect time”.
- Add conversational clutter around a simple conversion.

### Messaging
- Primary brand line: “Time, translated.”
- Supporting line: “From any time to any zone.”
- Homepage direction: “Know the time. Across every zone.”
- Product descriptor: “A fast, precise time zone converter.”
- Extension descriptor: “Convert a time without leaving the page.”

## 7. Product experience principles
1. **Answer is the hero:** converted time and destination date are the strongest elements.
2. **Direction is explicit:** source and destination must never be ambiguous.
3. **Date is part of the answer:** display next-day/previous-day rollover visibly.
4. **DST is explained:** state when daylight-saving rules change the offset.
5. **Controls are calm:** searchable zone selection, clear date/time controls, accessible keyboard behaviour.
6. **One primary action:** avoid competing CTA styles.
7. **Performance is brand:** no decorative animation or oversized imagery that compromises speed.

### Signature product visual: the conversion bridge
Use a restrained source-to-destination relationship: source on one side, result on the other, with a subtle arrow/connector. The logo itself remains the TZ monogram; do not turn the logo into a complicated flow diagram.

## 8. UI design system
- Spacing base: 4 px; common steps 8, 12, 16, 24, 32, 48, 64 px.
- Radius: 8 px compact controls; 12 px inputs/cards; 18–24 px larger surfaces.
- Borders: light #E5E5E5; dark #292929.
- Shadows: avoid by default; use only when elevation is functionally necessary.
- Buttons: black with white text in light theme; white with near-black text in dark theme.
- Secondary buttons: quiet outline or text treatment.
- Focus: clearly visible 2 px outline using theme focus token.
- Motion: 120–180 ms common transitions; maximum 260 ms for larger changes; respect reduced-motion preferences.
- Icons: consistent outline family, 1.75–2 px stroke, rounded joins; always pair important icons with labels.

## 9. Accessibility
- Meet WCAG 2.2 AA contrast for text and controls.
- Visible keyboard focus and logical tab order.
- Accessible labels for all inputs and icon-only actions.
- Screen readers must announce converted time and destination date together.
- Do not communicate meaning through colour alone.
- Support text zoom and responsive reflow without clipping time values.

## 10. Cross-platform use
### Website
Use horizontal logo in the main header; standalone mark for favicon. Keep the conversion task dominant in both themes.

### Chrome extension
Use the standalone mark at 16, 32, 48 and 128 px. Keep popup typography, controls and result hierarchy consistent with the website.

### Mobile app (future)
Use the standalone mark in platform icon containers. Test OS adaptive masks, safe areas and high-density exports before release.

### Social and sharing
Use the standalone mark for avatars. For Open Graph images, use the wordmark, a single clear conversion example and monochrome layout. Avoid stock world maps and flags.

## 11. Product and engineering constraints from the supplied project brief
The uploaded `CLAUDE.md` identifies:
- Next.js 15 App Router, Railway deployment behind Cloudflare.
- Chrome extension using Manifest V3; future mobile app reuses the same engine.
- Conversion-only scope: no weather, holidays, news, calendars, horoscopes or blog fluff.
- All time math through the engine using platform `Intl` and IANA time-zone data; never hard-code offsets or DST dates.
- Answer-first pages: the first text after H1 is a server-rendered answer sentence containing conversion values.
- Live clocks render client-side after mount; do not bake current clock time into cached HTML.
- Performance is a feature; follow the budgets in `docs/09`.
- SEO lint and engine tests must pass before deployment.
- Unknown slugs must return real 404s; valid non-indexed combinations use noindex, follow.
- Keyword mapping is one keyword to one canonical URL.

**Important:** The uploaded file references `docs/01` through `docs/14`, but those detailed documents were not included in the uploaded material. This brand brief must be reconciled with `docs/06-page-specs.md`, `docs/09-ui-performance-ads.md`, `docs/10-chrome-extension.md` and `docs/11-qa-tests-acceptance.md` before final implementation. Do not override their requirements.

## 12. Developer implementation checklist
- [ ] Copy approved SVG assets into a central `public/brand/` directory.
- [ ] Use the horizontal lockup in desktop header; use mark-only where space is constrained.
- [ ] Use explicit black/white logo assets according to theme; do not CSS-invert arbitrary logo files.
- [ ] Add `brand-tokens.css` to the global theme layer or map the JSON tokens to the existing token system.
- [ ] Use `data-theme="dark"` for the dark token set, or adapt to the existing theme mechanism without duplicating tokens.
- [ ] Use Geist Sans and Geist Mono only if they fit the existing font-loading/performance budget.
- [ ] Apply `font-variant-numeric: tabular-nums` to time values.
- [ ] Ensure date rollover and DST context remain explicit in both themes.
- [ ] Export raster icon sizes from the supplied SVG master for platform manifests; preserve padding and test at actual sizes.
- [ ] Verify contrast, keyboard focus, reduced motion and 200% zoom.
- [ ] Run all existing tests, SEO lint, build and smoke checks. Do not relax acceptance criteria to accommodate branding.
- [ ] Check real rendered HTML and performance budgets after implementation.

## 13. Asset inventory
- `01-logos/svg/`: master symbol, horizontal lockups, stacked lockups, reverse variants and app icons.
- `03-design-tokens/`: JSON and CSS tokens.
- `04-developer-handoff/`: this brief, README and implementation prompt.
- `05-reference/`: approved concept board for visual context.
- `02-guidelines/`: printable PDF guideline.

## 14. Trademark and finalization
This is a proposed visual identity, not legal trademark clearance. Before commercial launch, search relevant trademark registers and markets for “TimeToZone”, the TZ monogram and similar marks. Have a designer perform optical refinement and a legal professional review registrability. The generated SVGs are editable starting assets and should receive final small-size and distinctiveness review before release.
