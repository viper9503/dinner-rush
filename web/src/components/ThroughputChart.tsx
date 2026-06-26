import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { HistoryPoint } from "../types";

interface Props {
  history: HistoryPoint[];
}

export default function ThroughputChart({ history }: Props) {
  return (
    <div className="panel">
      <h2>Throughput (orders / sec)</h2>
      <div className="chart-legend">
        <span className="lg">
          <span className="swatch" style={{ background: "#3a9bff" }} />
          ingested
        </span>
        <span className="lg">
          <span className="swatch" style={{ background: "#2ecc71" }} />
          delivered
        </span>
      </div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={history}
            margin={{ top: 6, right: 10, bottom: 0, left: -18 }}
          >
            <defs>
              <linearGradient id="gIngest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3a9bff" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#3a9bff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gDeliver" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2ecc71" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#2ecc71" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#5a6677", fontSize: 11 }}
              stroke="#1f2937"
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: "#5a6677", fontSize: 11 }}
              stroke="#1f2937"
              allowDecimals={false}
              width={42}
            />
            <Tooltip
              contentStyle={{
                background: "#111722",
                border: "1px solid #2c3a52",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#8b97a7" }}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="ingest"
              name="ingest/s"
              stroke="#3a9bff"
              strokeWidth={2}
              fill="url(#gIngest)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="deliver"
              name="deliver/s"
              stroke="#2ecc71"
              strokeWidth={2}
              fill="url(#gDeliver)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
