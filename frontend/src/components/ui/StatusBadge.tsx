import { Badge } from "@/components/ui/badge";

type Status = "ok" | "warn" | "overdue";

interface Props {
  status: Status;
  label?: string;
}

const LABELS: Record<Status, string> = {
  ok: "ปกติ",
  warn: "ใกล้ครบ",
  overdue: "เกินกำหนด",
};

export default function StatusBadge({ status, label }: Props) {
  return <Badge variant={status}>{label ?? LABELS[status]}</Badge>;
}
