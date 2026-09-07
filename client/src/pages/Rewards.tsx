import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { errorText, money, rarityColor, rarityNames, uuid } from "@/lib/study";
import { trpc } from "@/lib/trpc";
import { Gift, LockKeyhole, ShoppingBag, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const rarities = ["all", "common", "uncommon", "rare", "epic", "legendary", "mythic"];

export default function Rewards() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.rewards.list.useQuery();
  const { data: customRewards } = trpc.customRewards.list.useQuery();

  const [filter, setFilter] = useState("all");
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customCost, setCustomCost] = useState(100);
  const [customIcon, setCustomIcon] = useState("🎮");

  const items = useMemo(() => (data?.items ?? []).filter((x) => filter === "all" || x.rarity === filter), [data, filter]);

  const createCustomMutation = trpc.customRewards.create.useMutation({
    onSuccess: () => {
      utils.customRewards.list.invalidate();
      setIsAddingCustom(false);
      setCustomTitle("");
      toast.success("تم إضافة المزامنة لمكافأتك الشخصية!");
    },
  });

  const deleteCustomMutation = trpc.customRewards.delete.useMutation({
    onSuccess: () => {
      utils.customRewards.list.invalidate();
      toast.success("تم حذف المكافأة الشخصية.");
    },
  });

  const purchase = trpc.rewards.purchase.useMutation({
    onSuccess: async (r) => {
      if (r.purchased) toast.success(`تم شراء ${r.reward}.`);
      else toast.message("تم تسجيل هذه العملية مسبقًا.");
      await Promise.all([
        utils.rewards.list.invalidate(),
        utils.coins.ledger.invalidate(),
        utils.dashboard.summary.invalidate(),
        utils.analytics.overview.invalidate(),
      ]);
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) {
      toast.error("ادخل عنوان المكافأة الشخصية.");
      return;
    }
    createCustomMutation.mutate({ title: customTitle, cost: customCost, icon: customIcon });
  };

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-muted" />;
  if (!data) return <EmptyState title="المتجر غير متاح" description="حاول تحديث الصفحة لاحقًا." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="متجر المكافآت والحوافز"
        description="حمول ساعات مذاكرتك إلى Coins واستبدلها بمكافآت واقعية وأنشطة مخصصة لك!"
      />

      {/* Top Balance Bar */}
      <div className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center rounded-3xl border">
        <div className="flex items-center gap-3">
          <span className="metric-icon bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <Gift />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">رصيدك المتاح</p>
            <p className="font-[Manrope] text-2xl font-extrabold text-primary">{money.format(data.coins.balance)} Coins</p>
          </div>
        </div>

        <div className="mr-auto flex flex-wrap gap-1">
          {rarities.map((x) => (
            <button
              key={x}
              onClick={() => setFilter(x)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                filter === x ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {x === "all" ? "الكل" : rarityNames[x]}
            </button>
          ))}
        </div>
      </div>

      {/* Personal Rewards Section */}
      <div className="surface p-6 rounded-3xl border space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <h2 className="font-bold text-base">مكافآتك الشخصية المخصصة (Personal Rewards)</h2>
          </div>

          <Button size="sm" onClick={() => setIsAddingCustom(!isAddingCustom)} className="gap-1.5 rounded-xl font-bold">
            <Plus className="size-4" /> إضافة مكافأة خاصة
          </Button>
        </div>

        {isAddingCustom && (
          <form onSubmit={handleAddCustom} className="p-4 bg-muted/30 rounded-2xl border space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">اسم المكافأة الشخصية</label>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="مثال: ساعتين لعب سوني / خروجة مع الأصدقاء"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">تكلفة الـ Coins</label>
                <Input type="number" value={customCost} onChange={(e) => setCustomCost(Number(e.target.value))} min={10} max={5000} />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">الأيقونة / الإيموجي</label>
                <Input value={customIcon} onChange={(e) => setCustomIcon(e.target.value)} placeholder="🎮" />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddingCustom(false)}>
                إلغاء
              </Button>
              <Button type="submit" size="sm" className="font-bold">
                حفظ المكافأة
              </Button>
            </div>
          </form>
        )}

        {customRewards && customRewards.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customRewards.map((cr: any) => {
              const afford = data.coins.balance >= cr.cost;

              return (
                <div key={cr.id} className="p-4 rounded-2xl border bg-card flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cr.icon}</span>
                    <div>
                      <h3 className="font-bold text-sm">{cr.title}</h3>
                      <span className="text-xs font-extrabold text-primary">{cr.cost} Coins</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={afford ? "default" : "outline"}
                      disabled={!afford}
                      onClick={() => toast.success(`تم استبدال المكافأة الشخصية: ${cr.title}! استمتع ببوقتك 🎉`)}
                      className="rounded-xl text-xs font-bold"
                    >
                      {afford ? "استبدال" : "رصيد غير كافٍ"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteCustomMutation.mutate({ rewardId: cr.id })}
                      className="size-8 text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            لم تقم بإضافة مكافآت شخصية بعد. انقر على "إضافة مكافأة خاصة" لإضافة مكافآتك المفضلة (مثل ساعات اللعب أو الخروجات)!
          </p>
        )}
      </div>

      {/* Catalog Rewards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((reward) => {
          const afford = data.coins.balance >= reward.cost;
          return (
            <div key={reward.id} className="surface p-4 rounded-2xl border">
              <div className="mb-4 flex items-start justify-between">
                <span className="metric-icon bg-primary/10 text-primary">
                  <ShoppingBag />
                </span>
                <Badge className={rarityColor[reward.rarity]}>{rarityNames[reward.rarity]}</Badge>
              </div>

              <h2 className="font-semibold">{reward.title}</h2>

              <div className="mt-4 flex items-center justify-between">
                <b className="font-[Manrope] text-primary">{money.format(reward.cost)} Coins</b>
                <Button
                  size="sm"
                  variant={afford ? "default" : "outline"}
                  disabled={!afford || purchase.isPending}
                  onClick={() => purchase.mutate({ rewardId: reward.id, referenceKey: uuid() })}
                  className="rounded-xl font-bold"
                >
                  {afford ? (
                    "شراء"
                  ) : (
                    <>
                      <LockKeyhole className="size-3.5 ml-1" />
                      غير كافٍ
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
