import { InsightPanel } from '../insights/InsightPanel';

export default function InsightsWorkspace({ recordCount }: { recordCount: number }) {
  return <InsightPanel recordCount={recordCount} />;
}
