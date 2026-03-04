interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  min?: number;
  max?: number;
}

export default function Sparkline({
  data,
  width = 300,
  height = 60,
  color = "#ef4444",
  fillColor,
  min,
  max,
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="w-full">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.3} />
      </svg>
    );
  }

  const lo  = min ?? Math.min(...data);
  const hi  = max ?? Math.max(...data);
  const pad = 2;

  function xOf(i: number) {
    return pad + (i / (data.length - 1)) * (width - pad * 2);
  }
  function yOf(v: number) {
    if (hi === lo) return height / 2;
    return pad + ((1 - (v - lo) / (hi - lo)) * (height - pad * 2));
  }

  const points = data.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" ");
  const fill = fillColor ?? color + "22";

  const areaPoints = [
    `${xOf(0)},${height}`,
    ...data.map((v, i) => `${xOf(i)},${yOf(v)}`),
    `${xOf(data.length - 1)},${height}`,
  ].join(" ");

  const last = data[data.length - 1];
  const cx = xOf(data.length - 1);
  const cy = yOf(last);

  return (
    <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {/* Area fill */}
      <polygon points={areaPoints} fill={fill} />
      {/* Line */}
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* Last-point dot */}
      <circle cx={cx} cy={cy} r={3} fill={color} />
    </svg>
  );
}
