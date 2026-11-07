# Northstar glass build: independent critique

Method: I loaded the demo data, then checked every route at 1440x900 and 390x844 using scrolled screenshots and the page text. I also ran a fresh profile to see the empty states, and opened the capture sheet and the command palette. I did not read any source code.

## 1. Cringe

**High**
- **Command palette (Ctrl+K):** the Go-to rows still show old names. Goals reads "Plan · Quest log" and Intel reads "You · Command". *Fix:* drop the alias text from the visible subtitle and keep it only for search matching.
- **Interview, "What pulls you back":** the options include "Levels and XP" and "Boss goals", and the helper line says "Decides which game features get the screen space". *Fix:* replace these with "Rings and goals" and "Personal bests", and change the helper to "Decides what Today shows first".

**Medium**
- **Poppy red used as decoration:** the Food and Body page icons are red tiles, the Body icon on Areas is red, and the People ring and the circle dots on People are dusty rose (#D9A3A0), which reads as a warning. *Fix:* give these icons a neutral or powder-blue tile, and keep red only for overdue or behind pace.
- **Gold used for routine wins:** Habits turns the ring and the "4 of 4" text gold when a weekly target is met, and the Milestones and You tiles use a gold trophy icon. Weekly targets are routine, so gold stops meaning anything special. *Fix:* use blue for weekly targets met. Keep gold for milestone dots only, and swap the trophy icon for a flag or bookmark.
- **Copy:** "15 points behind pace" (Goals, Plan) sounds like a score. "Fed this week" (Areas) is odd. Intel says "study streak about to lapse", which is loss language. *Fix:* "1 milestone behind pace", "This week", and "No study logged in 3 days".

**Low**
- **Monospace uppercase eyebrows** ("THE WEEK", "NEXT MILESTONES", "DUE NOW") read as dev or terminal styling. *Fix:* use Inter small caps at the label size.
- **Style tile is a public route** with the wrong hub strip (Areas). *Fix:* hide it in production builds.

## 2. Glass

**High**
- **Desktop top bar:** content scrolls under it and stays readable. "Open slot" collides with "Today", and "Investments / Add a holding…" sits under "Money". This fails as text on glass. *Fix:* raise the thin-tier tint to about 70% and blur to at least 20px, or add a 12px fade mask at the bottom edge.
- **Phone tab bar plus the sticky quick-add on Tasks and Food:** list text shows through both layers ("Earn the compliance certification", "Add what you own…"). On Tasks and Food, three stacked floating layers take about 180px. *Fix:* give the sticky add bar a solid regular tier, or tuck it into the capture sheet on phone.

**Medium**
- **Cards are too uniform:** almost every card has the same rim and translucency, so chrome and content still look alike. *Fix:* make content cards solid raven (surface-1) with a hairline, and keep glass for the bar, rail, sheets and heroes only.
- **Right rail repeats on every desktop page** (Season, Today's plan, This week, Recent). The page feels busy, and the plan list is duplicated on Today. *Fix:* show the rail on Today only, or collapse it to the season line.

**Low**
- **Capture sheet and palette:** the blur and scrim look good. The sheet's chip row is the strongest glass moment, so use it as the reference for the other surfaces.

## 3. Feel and consistency

**High**
- **Food:** the 3,000 kcal goal is nowhere. The hero is a text card saying "Set targets", there is no day total, and Today shows "1,620" next to an empty ring. *Fix:* default the target to 3,000 when the owner profile says so, and make "1,620 of 3,000 kcal" plus the ring the Food hero.
- **Money:** the numbers don't agree. The ring says 94% while the text says "6% used". The hero says $45 spent while Cash flow says $1,520. "Subscriptions $1,622/mo" includes Rent and Electric. The net worth axis uses odd ticks ($9,462, $8,562) and says "$690.00 to go" with stray decimals. *Fix:* make the ring show spent, label the hero "budgeted spending", split bills from subscriptions, use round ticks, and drop the cents.
- **Today:** about 12 blocks stacked (plan, calories and money, focus, agenda, daily find, KPI strip, your day, quarter, next up, worth a look, across your life, habits). Next up duplicates Agenda. *Fix:* keep one hero and move the rest behind "More".

**Medium**
- **Rings are inconsistent:** sizes run 44, 64, 72 and 104px, the centre shows a bare "50" on Plan but "50%" on Goals, and Areas shows "6/5" (over 100%). *Fix:* use two ring sizes, a consistent unit, and cap the display at the target.
- **Phone layouts:** the hub strips clip ("Settin", Money tabs hide Investments and Import) with no fade or scroll hint. On Season, the Back/Next/Share buttons sit under the FAB. On People, the circle fills the first screen. On Tasks, the KPI grid pushes the list below the fold. On Season desktop, the story carousel shows a clipped "WINS New ne" card.
- **Tap targets:** task checkboxes are 18px, pin icons about 18px, People orbit dots 22px, Season dots 8px, Intel facet checkboxes 16px, and Settings switches and links 17–24px tall.
- **Old palette leftovers:** green (#6CC49A) on Season insight tags and Data status dots, and amber (#F2C46B) on habit rings.

**Low**
- **Interview** has no page header, icon or document title ("Northstar"), and its hub strip has nothing active. **Style** has the same problem.
- **Empty Money** shows "No budget yet" at hero size. That shouts an absence. *Fix:* use body-size text with the button.
- **Small text bugs:** "12 -week run" has a stray space. The Body weight input placeholder sits off-centre vertically.

## 4. Regression (checked by eye)
- **Money:** the no-spend grid, savings ring and bills set-aside chips are not visible on Overview. Only the recap line mentions a savings rate.
- **Food:** the macro rings and LeftToday don't show without targets, and there is no "Targets from estimate" shortcut on the hero.
- **Body:** the hero, path chart and checkpoint chips can't be confirmed, because the demo has no weigh-ins and the first-weigh-in card shows instead.
- **Today:** FirstRunCard, FocusBar "0 of 3 open", Agenda Now/Next tags, KPI strip, Habits tile with week badges, Quarter goals and Insights are all present.
- **Shell:** Ontology is still in the You strip. The capture sheet's quick logs (Weigh-in, Meal, Win, Journal) are present. Document titles are missing on Interview and Style.
- **Milestones:** the rarity and "New" tags are gone, as intended. Next milestones rows are present.

## Gen Z gut check
The screen they'd screenshot first is **Habits**: the heat grid, the rings and the check circles look like a polished iOS app. The one they'd never show is **Today**. It's a long scroll of repeated cards with a "0/5" ring in the header and a nudge saying "You have never exported a backup", so it feels like a to-do app scolding you.
