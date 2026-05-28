import React from "react";

interface SizeMeasurements {
  A: number;
  B: number;
  C: number;
}

type SizeChart = Record<string, SizeMeasurements>;

// Default measurements (mm) — based on standard garment sizing
const DEFAULT_SIZE_CHART: SizeChart = {
  S:    { A: 711, B: 508, C: 864 },
  M:    { A: 737, B: 559, C: 889 },
  L:    { A: 762, B: 610, C: 914 },
  XL:   { A: 787, B: 660, C: 940 },
  XXL:  { A: 812, B: 711, C: 965 },
  "3XL":{ A: 838, B: 762, C: 991 },
  "4XL":{ A: 863, B: 813, C: 1016 },
};

function parseSizeChart(metaData: Array<{ key: string; value: any }> | undefined): SizeChart | null {
  if (!metaData) return null;
  const entry = metaData.find(
    (m) => m.key === "_size_chart" || m.key === "size_chart"
  );
  if (!entry?.value) return null;
  try {
    const parsed = typeof entry.value === "string" ? JSON.parse(entry.value) : entry.value;
    if (typeof parsed === "object" && !Array.isArray(parsed)) return parsed as SizeChart;
  } catch {
    // ignore
  }
  return null;
}

interface SizeChartProps {
  wcProductMetaData?: Array<{ key: string; value: any }>;
}

export const SizeChart: React.FC<SizeChartProps> = ({ wcProductMetaData }) => {
  const chart = parseSizeChart(wcProductMetaData) ?? DEFAULT_SIZE_CHART;
  const sizes = Object.keys(chart);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {/* Diagram */}
        <div className="shrink-0 flex items-center justify-center">
          <svg
            viewBox="0 0 160 180"
            width="130"
            height="150"
            className="text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            {/* Garment silhouette */}
            <path
              d="M55 18 L30 40 L20 80 L35 82 L35 160 L125 160 L125 82 L140 80 L130 40 L105 18 Q90 28 80 28 Q70 28 55 18 Z"
              strokeLinejoin="round"
            />
            {/* Neck */}
            <path d="M67 18 Q80 32 93 18" strokeLinecap="round" />

            {/* A — length arrow (left side) */}
            <line x1="14" y1="28" x2="14" y2="158" stroke="#3b82f6" strokeWidth="1.2" />
            <line x1="10" y1="28" x2="18" y2="28" stroke="#3b82f6" strokeWidth="1.2" />
            <line x1="10" y1="158" x2="18" y2="158" stroke="#3b82f6" strokeWidth="1.2" />
            <text x="6" y="96" fill="#3b82f6" stroke="none" fontSize="11" fontWeight="bold" textAnchor="middle" transform="rotate(-90,6,96)">A</text>

            {/* B — chest width arrow (horizontal, ~chest level) */}
            <line x1="36" y1="95" x2="124" y2="95" stroke="#3b82f6" strokeWidth="1.2" />
            <line x1="36" y1="91" x2="36" y2="99" stroke="#3b82f6" strokeWidth="1.2" />
            <line x1="124" y1="91" x2="124" y2="99" stroke="#3b82f6" strokeWidth="1.2" />
            <text x="80" y="110" fill="#3b82f6" stroke="none" fontSize="11" fontWeight="bold" textAnchor="middle">B</text>

            {/* C — sleeve length arrow (diagonal along sleeve top) */}
            <line x1="55" y1="18" x2="20" y2="80" stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="3 2" />
            <text x="30" y="45" fill="#3b82f6" stroke="none" fontSize="11" fontWeight="bold" textAnchor="middle">C</text>
          </svg>
        </div>

        {/* Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold text-foreground w-12"></th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">A (mm)</th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">B (mm)</th>
                <th className="text-right py-2 px-3 font-semibold text-foreground">C (mm)</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((size, i) => (
                <tr
                  key={size}
                  className={i % 2 === 0 ? "bg-muted/30" : ""}
                >
                  <td className="py-1.5 pr-4 font-semibold text-foreground">{size}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{chart[size].A}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{chart[size].B}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{chart[size].C}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Alle Maße in Millimetern. Abweichungen von ±5 % sind fertigungsbedingt möglich.
      </p>
    </div>
  );
};
