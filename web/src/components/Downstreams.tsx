import type { Snapshot } from "../types";
import DownstreamCard from "./DownstreamCard";

interface Props {
  downstreams: Snapshot["downstreams"];
}

export default function Downstreams({ downstreams }: Props) {
  return (
    <div className="panel">
      <h2>Downstream health</h2>
      <div className="downstreams">
        <DownstreamCard title="Restaurant" health={downstreams.restaurant} />
        <DownstreamCard title="Courier" health={downstreams.courier} />
      </div>
    </div>
  );
}
