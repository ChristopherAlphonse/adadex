# Visual replies

An agent can answer with stat tiles, a chart and a table instead of prose. Write a fenced block tagged
`visual` containing JSON. The chat draws it as one card.

````
```visual
{
  "title": "Token use this week",
  "tiles": [
    { "label": "Tokens", "value": "12.8M", "detail": "13 days" },
    { "label": "Sessions", "value": 167 }
  ],
  "chart": { "kind": "bar", "title": "Tokens per day", "labels": ["Mon", "Tue", "Wed"], "values": [3.1, 5.4, 2.2] },
  "table": { "columns": ["Project", "Tokens"], "rows": [["adadex", "4.1M"], ["web", "2.0M"]] }
}
```
````

- Every part is optional, but a card needs at least one tile, a chart or a table.
- `chart.kind` is `bar` or `line`. `labels` and `values` are paired by position; extra ones are dropped.
- Limits: 8 tiles, 60 chart points, 12 columns, 100 rows. Numbers may be written as strings in tiles and cells.
- A block that is not valid JSON, or has nothing to draw, is shown as plain text.
