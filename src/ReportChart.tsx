export type ChartSeries = { name: string; values: (string | null)[]; color: string }
/** 无第三方图表依赖的SVG折线图，文字和表格保存精确金额，浮点仅用于图形位置。 */
export default function ReportChart({ title, labels, series }: { title: string; labels: string[]; series: ChartSeries[] }) {
  const numbers = series.flatMap(line => line.values.filter(value => value !== null).map(Number)).filter(Number.isFinite)
  const min = numbers.reduce((result, value) => Math.min(result, value), 0); const max = numbers.reduce((result, value) => Math.max(result, value), min + 1)
  const left = 82, top = 20, width = 620, height = 170
  /** 将金额映射到SVG纵轴，允许负净资产。 */
  function y(value: string) { return top + height - (Number(value) - min) / (max - min) * height }
  /** 将时间索引映射到横轴，单点图也能显示真实数据。 */
  function x(index: number) { return left + (labels.length < 2 ? width / 2 : index / (labels.length - 1) * width) }
  return <figure className="report-chart"><figcaption>{title}</figcaption><svg viewBox="0 0 735 245" role="img" aria-label={title}>
    {[0, .5, 1].map(value => <g key={value}><line x1={left} x2={left + width} y1={top + height * value} y2={top + height * value} stroke="#dde7e3" /><text x={left - 7} y={top + height * value + 4} textAnchor="end">{(max - (max - min) * value).toLocaleString(undefined, { maximumFractionDigits: 2 })}</text></g>)}
    {series.map(line => <g key={line.name}><path fill="none" stroke={line.color} strokeWidth={2.4} d={line.values.map((value, index) => value === null ? '' : `${index === 0 || line.values[index - 1] === null ? 'M' : 'L'}${x(index)},${y(value)}`).join(' ')} />{line.values.map((value, index) => value === null ? null : <circle key={index} cx={x(index)} cy={y(value)} r={labels.length < 40 ? 3 : 1} fill={line.color}><title>{labels[index]} · {line.name}: {value}</title></circle>)}</g>)}
    {labels.map((label, index) => index === 0 || index === labels.length - 1 || (index === Math.floor(labels.length / 2) && labels.length > 2) ? <text key={index} x={x(index)} y={220} textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'}>{label}</text> : null)}
  </svg><div className="report-legend">{series.map(line => <span key={line.name}><i style={{ background: line.color }} />{line.name}</span>)}</div></figure>
}
