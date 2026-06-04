import { useState } from "react";
import { BIKE_SPECS } from "../../data/bikeSpecs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  make: string;
  model: string;
}

export default function BikeSpecs({ make, model }: Props) {
  const [open, setOpen] = useState(false);
  const key = `${make} ${model}`.toLowerCase().replace(/\s+/g, " ").trim();
  const sections = BIKE_SPECS[key];
  if (!sections) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        style={{ color: "var(--purple)" }}
      >
        ข้อมูลจำเพาะ {make} {model}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[540px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ข้อมูลจำเพาะ {make} {model}</DialogTitle>
          </DialogHeader>

          <div style={{ padding: "0 0 12px" }}>
            {sections.map((section, si) => (
              <section key={section.title}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "var(--purple)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  padding: "16px 24px 8px",
                  borderTop: si > 0 ? "1px solid var(--hairline)" : "none",
                }}>
                  {section.title}
                </div>
                {section.items.map((item, i) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "8px 24px",
                      background: i % 2 === 1 ? "var(--surface-soft)" : "transparent",
                    }}
                  >
                    <div style={{ flex: "0 0 40%", fontSize: 12, color: "var(--slate)", lineHeight: 1.5 }}>
                      {item.label}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
