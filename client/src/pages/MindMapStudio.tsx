import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Network, ChevronDown, ChevronRight, Layers, HelpCircle, Download } from "lucide-react";
import { toast } from "sonner";

interface MindNode {
  label: string;
  description?: string;
  children?: MindNode[];
}

function NodeCard({ node, depth = 0 }: { node: MindNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const depthColors = [
    "bg-primary text-primary-foreground border-primary",
    "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300",
    "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
    "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300",
  ];

  const badgeColor = depthColors[depth % depthColors.length];

  return (
    <div className="space-y-3 relative">
      <div
        className={`p-4 rounded-2xl border shadow-xs transition-all ${
          depth === 0 ? "bg-primary text-primary-foreground p-5" : "bg-card hover:border-primary/40"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {hasChildren && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className={`p-1 rounded-lg ${depth === 0 ? "hover:bg-white/20" : "hover:bg-muted"}`}
                >
                  {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>
              )}
              <h4 className={`font-bold ${depth === 0 ? "text-lg" : "text-sm"}`}>{node.label}</h4>
            </div>
            {node.description && (
              <p className={`text-xs leading-5 ${depth === 0 ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {node.description}
              </p>
            )}
          </div>

          {depth > 0 && (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeColor}`}>
              مستوى {depth}
            </span>
          )}
        </div>
      </div>

      {/* Children branches */}
      {hasChildren && expanded && (
        <div className="mr-6 pr-4 border-r-2 border-primary/20 space-y-3 relative">
          {node.children!.map((child, idx) => (
            <NodeCard key={idx} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MindMapStudio() {
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [mindMapData, setMindMapData] = useState<any>(null);

  const generateMutation = trpc.mindMap.generateAI.useMutation({
    onSuccess: (data) => {
      setMindMapData(data);
      toast.success("تم توليد الخريطة الذهنية التفاعلية بنجاح! (+25 Coins)");
    },
    onError: (e) => toast.error(e.message || "حدث خطأ أثناء توليد الخريطة."),
  });

  const handleGenerate = () => {
    if (!topic.trim() || !subject.trim()) {
      toast.error("يرجى إدخال اسم المادة والموضوع.");
      return;
    }
    generateMutation.mutate({ topic, subject });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="استوديو الخرائط الذهنية (AI Mind Map Studio)"
        description="حوّل أي درس أو باب صلب إلى خريطة مفاهيم تشجيرية تفاعلية لتسهيل الفهم والربط البصري السريع."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Form Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
            <div className="flex items-center gap-3 border-b pb-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Network className="size-5" />
              </div>
              <div>
                <h2 className="font-bold">إنشاء خريطة ذهنية جديدة</h2>
                <p className="text-xs text-muted-foreground">ادخل الدرس لتشجير أفكاره.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">اسم المادة الدراسيّة *</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: أحياء، تاريخ، فيزياء، كيمياء"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">اسم الدرس / الباب المراد تشجيره *</label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثال: الجهاز العصبي المركزي، الثورة الفرنسية"
              />
            </div>

            <Button
              disabled={generateMutation.isPending || !topic.trim() || !subject.trim()}
              onClick={handleGenerate}
              className="w-full h-12 rounded-2xl gap-2 font-bold shadow-md shadow-primary/20"
            >
              <Sparkles className="size-5" />
              <span>{generateMutation.isPending ? "جارٍ تصميم الخريطة..." : "إنشاء الخريطة الذهنية (+25 Coins)"}</span>
            </Button>
          </div>
        </div>

        {/* Mind Map Tree View */}
        <div className="lg:col-span-8 space-y-4">
          {mindMapData?.root ? (
            <div className="surface p-6 rounded-3xl border border-primary/30 space-y-5">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="size-5 text-primary" />
                  <h3 className="font-bold text-lg">الخريطة التفاعلية: {mindMapData.title}</h3>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 rounded-xl">
                  <Download className="size-4" /> طباعة / حفظ كـ PDF
                </Button>
              </div>

              <div className="p-4 bg-muted/20 rounded-2xl border">
                <NodeCard node={mindMapData.root} depth={0} />
              </div>
            </div>
          ) : (
            <div className="surface p-12 rounded-3xl border border-dashed border-border text-center space-y-3">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Network className="size-7" />
              </div>
              <h3 className="font-bold text-base">ابدأ بتشجير أفكار دروسك فوراً</h3>
              <p className="text-xs text-muted-foreground leading-5 max-w-md mx-auto">
                اكتب اسم الدرس والمادة وسيقوم الذكاء الاصطناعي برسم وتسلسل العناوين الرئيسية والفرعية لتسهيل التذكر والتصفح البصري.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
