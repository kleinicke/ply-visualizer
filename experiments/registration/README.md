# Registration experiment suite

A bench for trying registration strategies against each other on scenes whose
answers are known, so a change can be shown to help rather than argued to.

## Why it exists

Multiway registration — placing many unordered scans into one frame — fails in
several unrelated ways, and on a real archive they arrive tangled together. The
suite separates them: each synthetic scene isolates one structural property, and
the real archives are the acceptance test at the end.

## Running

```bash
node experiments/registration/validate.mjs   # what each scene asks of a solver
node experiments/registration/recall.mjs     # is the true pose even proposed?
```

`recall.mjs` takes `[scene] [ladder] [candidates] [peaksPerYaw]`, e.g.
`node recall.mjs hub 8,4,2,1 8 3`.

## The scenes

| scene        | isolates                              | shape                      |
| ------------ | ------------------------------------- | -------------------------- |
| `hub`        | everything overlaps everything        | one room, 4 stations       |
| `chain`      | neighbours only, drift can accumulate | corridor, 7 stations       |
| `loop`       | a chain that closes on itself         | square ring, 12 stations   |
| `wall`       | positional degeneracy                 | one flat plane, 3 stations |
| `rooms`      | two clusters joined weakly            | two rooms and a doorway    |
| `duplicates` | scans sharing a station exactly       | hub, two scans per station |

Scenes are ray-cast from axis-aligned surfaces over an azimuth/elevation window,
so they carry the two properties that drive registration behaviour: occlusion,
and a wedge of directions rather than a ball of points.

**Validate before concluding.** Three times while building this, a scene turned
out harder than intended — an empty rectangular room that maps onto itself under
a half turn, a corridor so featureless that stacking two scans scores better
than placing them correctly, and a ring of stations on a circle inside a square
annulus, which puts half of them in the wrong room. All three looked like solver
failures. `validate.mjs` reports each scene's own difficulty first: shared
overlap per pair at ground truth, and how well each cloud's geometry pins its
own position down.

## Measuring

Everything is scored **frame-free**. A set of poses is only determined up to a
global rigid transform, so comparing matrices needs an alignment step that can
itself hide errors; the _relative_ pose of two clouds does not depend on the
frame. The same comparison scores against ground truth on synthetic scenes and
against a second run on real archives, which is what makes the two comparable.

## Ground truth

`groundtruth/` holds surveyed registrations supplied by the operator from the
instrument vendor's software, for three archives. Coverage is partial on purpose
— the scans whose placement they had reason to trust — and every metric compares
relative poses over whatever subset is present, so a partial survey still scores
a full run.

Scoring a real archive against it:

```bash
node experiments/registration/score-archive.mjs <path> [budget] [windowFactor] [ladder]
```

## What has been established

- **Recall is the bottleneck, not selection.** Cycle consistency, pose graphs
  and robust weighting can only choose among the transforms the pairwise stage
  proposed. On the synthetic room the true transform reached the shortlist for
  only 2 of 6 pairs, so no selector could have recovered the scene.
- **The scale ladder controls capture range, and it is a large effect.**
  Refining the same five coarse candidates on one pair, `[4,2,1]` reached the
  true pose from none of them, `[8,4,2,1]` from one, `[16,8,4,2,1]` from three.
  The FFT stage proposes a yaw and almost no translation; the coarse ICP levels
  are what walk the cloud into place, metres if the ladder allows it.
- **Score cannot separate right from wrong.** On the same pair the true pose
  scored 18 % overlap and a wrong one 27 %. Fitness, RMS and the combined
  quality all prefer the wrong answer, which is why global consistency is needed
  rather than a better local score.

## Cautions, learned the hard way

Synthetic scenes mislead in two distinct ways, and only the first is caught
automatically.

**Impossible scenes.** A scene whose pairs share no surface is not a hard test.
`validate.mjs` reports overlap and conditioning before any strategy runs, which
catches this.

**Unrepresentative scenes.** Harder, and not yet automated. Synthetic station
spacing of 4-9 m against 12 m clouds made the coarse stage's translation search
window look like the binding constraint, and widening it doubled recall. On real
archives — stations 0.6-13 m apart, much larger clouds — the same change is
worth nothing. Incidental parameters chosen for convenience decided which
mechanism dominated, and the conclusion did not transfer.

Since surveyed coordinates now exist for three archives, synthetic station
spacing and cloud extent should be calibrated against them rather than picked to
make a scene look tidy.
