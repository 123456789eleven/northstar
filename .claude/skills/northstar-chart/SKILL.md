---
name: northstar-chart
description: Use when adding a chart to Northstar - fastest path to a consistent, accessible recharts chart that matches the existing ones
---

# Charts

1. Load the `dataviz` skill once; then copy an existing chart rather than starting fresh: bars `features/food/MiniBars.tsx` (single amber series, tooltip, Table toggle), money `features/finance/charts.tsx` (blue income / orange spending, validated pair), trend lines `features/review/RatingsTrend.tsx`, mood `features/journal/MoodChart.tsx`.
2. Rules: one series = amber (`var(--accent)`); two series = the Finance pair; thin bars (<=24px) with 4px top radius; 1px solid hairline grid, no vertical grid, one axis; custom tooltip with tabular numbers; legend only for >1 series; no 3D, no gradients.
3. Always offer the numbers (Table toggle or tooltip) and an `aria-label` summary.
4. Phone: `ResponsiveContainer` height 160-220; never wider than the card.
5. Prepare data in a pure function (tested), not inside the component.
