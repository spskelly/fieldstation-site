# fieldstation-site

The published output of a backyard bird feeder station: which birds came,
when, and how sure the station is. Served by GitHub Pages from this branch.
Everything here is generated. There is nothing to edit by hand, and any hand
edit is overwritten by the next publish.

The generator is a separate, private project called Fieldstation. It runs on
a machine at the station, watches one feeder with a camera and a microphone,
identifies birds locally, and pushes the result here. This repo holds only
what it decided to publish.

## What is here

| Path | What it is |
| --- | --- |
| `index.html`, `log/`, `species/`, `about/` | Static shells. Each one loads `app.js`, which reads the data files and renders the page in the browser. The home page (`index.html`) is the current day; `log/` is the narrative feed. |
| `app.js`, `style.css` | The whole front end. No build step, no framework. |
| `data/index.json` | Station name, timezone, first and latest dates, and one summary row per species (status, totals seen and heard, first and last dates, best image). |
| `data/days/YYYY-MM-DD.json` | One file per local day: sunrise and sunset, weather, counts, the species-by-hour grid, the timeline of detections, the highlights, the day's narrative editions, and the recap written the next morning. |
| `data/species/<slug>.json` | One file per species: status, totals, hourly profile, per-day counts, and every record with its time, kind (seen or heard) and confidence. |
| `data/feed/YYYY-Www.json` | One file per ISO week: one post per day, newest first (the day's recap, or its latest edition until the recap is written), which the Log page reads. |
| `media/YYYY-MM-DD/<id>.jpg` | Crops of birds the camera tracked, at most 1024 px on the long side. Only crops of target classes are ever published. |

Day files are appended and never rewritten unless the station is asked to
re-render that day, which happens when a person rejects or verifies a visit
after the fact. The index, the species files and the feed are rebuilt from the
day files on every publish. The station publishes today's day file every ten
minutes when something changed, a narrative edition a few times a day, and a recap of the day before shortly before sunrise.

## How to read it

Every species claim carries a status. `confirmed` means a visual record
passed the publication check, or the microphone recorded the species often
enough across separate hours to count. `unverified` means one line of
evidence with nothing backing it, which for an unusual species usually means
a classifier error. The About page on the site explains the tiers, the two
sensors, and their known failure modes in more detail than this file.

Seen and heard are not comparable counts. A bird calling from a hedge all
morning is heard dozens of times and seen never. A silent visitor at the
feeder is the reverse. Audio detections are three-second classifier windows,
so one bird singing for a minute produces many.

## What is never published

People, vehicles and faces are never stored by the station and never appear
here. The published location is randomized within 1 km. No uptime, health,
camera schedule or occupancy information is published. Times are when a bird
was seen or heard.

## Using the data

The JSON files are plain and can be read directly. If you build on them,
expect fields to be added over time. Species identifications are automated;
a person reviews some visits after the fact, and a rejection removes the
record from the next publish. Treat the rest as observations by a machine,
not as vetted records. Attribution to this repo is appreciated.
