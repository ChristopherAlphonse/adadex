import type { VisualCard, VisualChart } from "@adadex/core";

const CHART_WIDTH = 480;

const CHART_HEIGHT = 140;

const PAD = 8;

const formatNumber = (value: number): string =>
  Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(Math.round(value * 100) / 100);

const pointsOf = (chart: VisualChart) => {
  const max = Math.max(...chart.values, 0);
  const min = Math.min(...chart.values, 0);
  const span = max - min || 1;
  const step = (CHART_WIDTH - PAD * 2) / Math.max(chart.values.length, 1);

  return chart.values.map((value, index) => ({
    key: `${chart.labels[index] ?? index}-${value}`,
    label: chart.labels[index] ?? "",
    value,
    x: PAD + step * index + step / 2,
    y: PAD + (CHART_HEIGHT - PAD * 2) * (1 - (value - min) / span),
    step,
  }));
};

const Chart = ({ chart }: { chart: VisualChart }) => {
  const points = pointsOf(chart);
  const baseline = CHART_HEIGHT - PAD;
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <figure className="m-0 px-3 pb-3">
      {chart.title ? (
        <figcaption className="pb-1 text-xs text-muted-foreground">{chart.title}</figcaption>
      ) : null}
      <svg
        aria-label={chart.title ?? "Chart"}
        className="h-auto w-full"
        role="img"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        {chart.kind === "line" ? (
          <polyline
            className="fill-none stroke-running"
            points={line}
            strokeLinejoin="round"
            strokeWidth="2"
          />
        ) : (
          points.map((point) => (
            <rect
              className="fill-running"
              height={Math.max(baseline - point.y, 1)}
              key={point.key}
              width={Math.max(point.step * 0.7, 2)}
              x={point.x - (point.step * 0.7) / 2}
              y={point.y}
            />
          ))
        )}
      </svg>
      <div className="flex justify-between px-2 text-[11px] text-muted-foreground">
        <span>{chart.labels[0]}</span>
        <span>
          max {formatNumber(Math.max(...chart.values))} · {chart.labels[chart.labels.length - 1]}
        </span>
      </div>
    </figure>
  );
};

/** Stat tiles, a chart and a table an agent drew with a fenced `visual` block. */
export const VisualCardView = ({ visual }: { visual: VisualCard }) => (
  <section
    aria-label={visual.title ?? "Visual"}
    className="overflow-hidden rounded-xl border border-border bg-card text-sm"
  >
    {visual.title ? <p className="m-0 px-4 pt-3 pb-1 font-medium">{visual.title}</p> : null}
    {visual.tiles.length > 0 ? (
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {visual.tiles.map((tile) => (
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2" key={tile.label}>
            <p className="m-0 text-xs text-muted-foreground">{tile.label}</p>
            <p className="m-0 text-lg font-semibold">{tile.value}</p>
            {tile.detail ? (
              <p className="m-0 text-[11px] text-muted-foreground">{tile.detail}</p>
            ) : null}
          </div>
        ))}
      </div>
    ) : null}
    {visual.chart ? <Chart chart={visual.chart} /> : null}
    {visual.table ? (
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              {visual.table.columns.map((column) => (
                <th className="px-3 py-1.5 font-semibold text-muted-foreground" key={column}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visual.table.rows.map((row) => (
              <tr className="border-t border-border" key={row.join("|")}>
                {row.map((cell, index) => (
                  <td
                    className="px-3 py-1.5"
                    key={`${visual.table?.columns[index] ?? index}-${cell}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : null}
  </section>
);
