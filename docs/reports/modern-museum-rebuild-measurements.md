# modern-museum navigation rebuild — measurement pass (in progress)

Working notes for the 2026-08-05 navigation rebuild. **Nothing here has been
applied to the manifest yet.** Authority order per owner: written instructions →
guide sheet → walkthrough video → panorama imagery.

Angles are panorama-space degrees: yaw 0 = equirect centre, positive clockwise,
±180 at the seam; pitch positive up.

## Number → slug (verified by SHA-256 of the master files, 33/33 matched)

| # | slug | | # | slug | | # | slug |
|---|---|---|---|---|---|---|---|
| 01 | museum-forecourt | | 11 | noxx-passage | | 22 | grand-hall-colonnade |
| 02 | entrance-gate-west | | 12 | xealist-passage | | 23 | keepers-gallery |
| 03 | entrance-gate-east | | 13 | xealist-gallery-1 | | 24 | noxx-gallery-7 |
| 04 | entry-tunnel-west | | 14 | xealist-gallery-2 | | 25 | noxx-gallery-8 |
| 05 | entry-tunnel-east | | 15 | xealist-gallery-3 | | 26 | noxx-gallery-5 |
| 06 | main-concourse | | 16 | xealist-gallery-4 | | 27 | noxx-gallery-6 |
| 07 | noxx-concourse | | 17 | xealist-gallery-5 | | 28 | noxx-gallery-3 |
| 08 | welcome-wall | | 18 | xealist-gallery-6 | | 29 | noxx-gallery-4 |
| 8.5 | noxx-hall-gate | | 19 | xealist-gallery-7 | | 30 | noxx-gallery-1 |
| 09 | xealist-concourse | | 20 | xealist-gallery-8 | | 31 | noxx-gallery-2 |
| 9.5 | xealist-hall-gate | | 21 | grand-hall | | 10 | museum-statement |

**Trap:** 24–31 do not follow slug order (24 → noxx-gallery-**7**, 30 → noxx-gallery-**1**).

## Topology confirmed from the guide sheet

- `01 → 02 → 04 → 06` (west/left chain) and `01 → 03 → 05 → 06` (east/right chain)
- `06 → 07` via the cylinder labelled **“The Noxx Hall”**; `06 → 09` via **“The Xealist Hall”**
- `07 → 11 → 30` and `09 → 12 → 13` (the two passages are straight tunnels)
- Blue/“purple” lines are long-distance links fanning from a single convergence
  point at the bottom of **21**

Ordering 06’s features by yaw gives −147 (arch), −38 (Noxx cylinder), +39
(Xealist cylinder), +147 (arch): the **second point from the left is the Noxx
cylinder**, which reconciles the owner’s two descriptions of the 06 → 07 route.

## Measured feature positions (17 of 33 scenes)

| # | feature | yaw | pitch | intended role |
|---|---|---|---|---|
| 01 | left entrance | −32 | +2 | → 02 |
| 01 | right entrance | +32 | +2 | → 03 |
| 02 | tunnel mouth | 0 | −12 | → 04 |
| 02 | Seismic Museum sign | +41 | 0 | → 01 |
| 03 | tunnel mouth | 0 | −12 | → 05 |
| 03 | Seismic Museum sign | −43 | −3 | → 01 |
| 04 | tunnel mouth | 0 | −18 | → 06 |
| 05 | tunnel mouth | 0 | −18 | → 06 |
| 06 | left arch + stairs | −147 | +18 | → 04 (west) |
| 06 | cylinder “The Noxx Hall” | −38 | +3 | → 07 |
| 06 | cylinder “The Xealist Hall” | +39 | +3 | → 09 |
| 06 | right arch + stairs | +147 | +18 | → 05 (east) |
| 07 | central portal | 0 | 0 | → 11 |
| 07 | “Welcome to the Seismic Museum” wall | −34 | 0 | → 08 |
| 07 | “The Noxx Hall” panel | +38 | +3 | → 8.5 |
| 07 | open hall / stairs back to concourse | +150 | −6 | → 06 |
| 08 | back into the concourse | +35 | −20 | → 07 (lower return) |
| 8.5 | back into the concourse | −30 | −20 | → 07 (lower return) |
| 10 | back into the concourse | −45 | −20 | → 09 (lower return) |
| 11 | forward opening | 0 | −8 | → 30 |
| 11 | tunnel behind | 180 | −8 | → 07 |
| 12 | forward opening | 0 | −10 | → 13 |
| 12 | tunnel behind | 180 | −8 | → 09 |
| 13 | central community stand | 0 | 0 | → 14 |
| 13 | tunnel mouth, upper left | −115 | +8 | → 12 (single reverse, per collapse rule) |
| 13 | right bay opening | +62 | −3 | → 15 |
| 20 | Roman temple | −7 | −8 | → 21 |
| 21 | blue PFP screen in the temple | 0 | +7 | → 23 |
| 21 | left opening | −108 | 0 | → 26 |
| 21 | right opening near the statue | +75 | 0 | → 19 |
| 26 | central stand (“Seismic coffee”) | −3 | +2 | → 27 |
| 26 | Roman temple on the right | +88 | +2 | → 21 |
| 27 | central stand | 0 | +2 | (zoomed view of 26’s stand) |
| 27 | Roman temple | +86 | +2 | → 21 |

## Still to measure (16 scenes)

09, 9.5, 14, 15, 16, 17, 18, 19, 22, 23, 24, 25, 28, 29, 30, 31.

Cached inputs for an immediate resume (scratchpad):
`grid/*.jpg` (33 full-sphere yaw/pitch overlays), `pairs/*.jpg` (15 horizon-band
sheets, pitch ±32), `guide/band-*.jpg` (6 full-resolution guide bands),
`boxes.json` (33 guide thumbnail boxes).

## Uncertain connections (not to be invented)

1. **21 “lower/purple” route involving 11 and 26.** 21 → 26 is already carried by
   the left opening. Image **11 is a straight two-ended tunnel** — its only
   openings are yaw 0 (→ 30) and yaw 180 (→ 07) — so a third link from 11 has no
   physical anchor. The blue fan converges at 21 but individual far endpoints
   could not be separated reliably: lines from 21 pass over intermediate
   thumbnails, so collinear crossings are indistinguishable from real endpoints.
2. **Which arch in 06 returns to 04 vs 05.** Assigned left → 04 (west) and
   right → 05 (east) on naming/chain consistency; not yet confirmed from video.
3. **21 → 20.** Required by the bidirectional rule because 20 → 21 exists, but
   not listed among 21’s four authored points; proposed as the physical reverse
   down the temple steps (yaw 180, pitch −20).

## Method notes

Two attempts to extract the guide’s red dots programmatically were abandoned as
unreliable: the marks are thin arrow glyphs rather than solid discs, and the
JPEG-degraded red either merges with the connector lines under a loose threshold
(46 blobs, mostly false) or vanishes under a strict one (4 blobs). Positions are
therefore measured from the panorama imagery, which is the owner’s designated
authority for precise yaw/pitch.
