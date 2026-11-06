// The Calculator's Tip mode (TipCalc, loaded when chosen; also Everyday's "Tip & split" tab)
export const tip = {
  "tip.form": "Tip calculator",
  "tip.bill": "Bill",
  "tip.pct": "Tip",
  "tip.presets": "Tip percent",
  "tip.custom": "Custom",
  "tip.customPct": "Custom tip %",
  // the main answer, and what it is: "15% of 80.00"
  "tip.tip": "Tip",
  "tip.of": "{p}% of {bill}",
  "tip.total": "Total",
  "tip.split": "Split between people",
  "tip.splitHint": "What each person pays",
  "tip.people": "People",
  "tip.fewer": "One person fewer",
  "tip.more": "One more person",
  "tip.each": "Each person pays",
  "tip.roundUp": "Round up each share",
  "tip.roundUpHint": "Everyone pays a whole amount, the extra goes to the tip",
  "tip.roundExtra": "Added by rounding up",
  "tip.unevenMore": "{n} shares of {each} come to {diff} more than the total",
  "tip.unevenLess": "{n} shares of {each} come to {diff} less than the total",
  // also put into "Copy {label}", lower-cased in English
  "tip.copyRow": "Copy {label}",
  "tip.rounded": "Rounded for display",
  "tip.inexact": "From an inexact input",
  "tip.enterBill": "Enter the bill. It can be a sum: 42.50 + 18",
} as const;
