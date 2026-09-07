import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { PdfFlashcardDropzone } from "@/components/PdfFlashcardDropzone";
import { errorText } from "@/lib/study";
import { trpc } from "@/lib/trpc";
import { Brain, CheckCircle2, Layers3, Plus, RefreshCw, Sparkles, Trash2, FileUp, Layers } from "lucide-react";
import { toast } from "sonner";

export default function Flashcards() {
  const [activeTab, setActiveTab] = useState<"dropzone" | "decks">("dropzone");
  const utils = trpc.useUtils();
  const { data: decks = [], isLoading } = trpc.flashcards.list.useQuery();
  const [activeDeck, setActiveDeck] = useState<number | null>(null);
  const selected = decks.find((deck) => deck.id === activeDeck) ?? decks[0] ?? null;

  const refresh = async () => {
    await utils.flashcards.list.invalidate();
  };

  if (isLoading) return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="بطاقات الاستذكار الفعال (Flashcards)"
        description="استخرج بطاقات المراجعة من ملفات الـ PDF بضغطة واحدة، أو راجع مجموعاتك بالتكرار المتباعد."
      />

      {/* TOP NAVIGATION TABS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-muted/60 border w-fit">
        <button
          onClick={() => setActiveTab("dropzone")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === "dropzone"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileUp className="size-4" />
          <span>سحب وإفلات PDF للتحويل الذكي</span>
          <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px]">
            AI Powered
          </Badge>
        </button>

        <button
          onClick={() => setActiveTab("decks")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeTab === "decks"
              ? "bg-card text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="size-4" />
          <span>مجموعاتي وسجل المراجعة ({decks.length})</span>
        </button>
      </div>

      {activeTab === "dropzone" ? (
        <div className="space-y-6">
          <PdfFlashcardDropzone
            onDeckSaved={() => {
              setActiveTab("decks");
              refresh();
            }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <DeckCreator onDone={refresh} />
          {!decks.length ? (
            <EmptyState
              title="لسه معندكش مجموعة"
              description="اسحب ملف PDF فوق لتحويله تلقائياً أو اعمل مجموعة فلاش كاردز لمادة أو فصل يدوياً."
            />
          ) : (
            <div className="grid gap-5 xl:grid-cols-[.34fr_1fr]">
              <aside className="space-y-3">
                {decks.map((deck) => (
                  <button
                    key={deck.id}
                    onClick={() => setActiveDeck(deck.id)}
                    className={`surface w-full p-4 text-right transition rounded-2xl border ${
                      selected?.id === deck.id ? "ring-2 ring-primary border-primary/50" : "hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className="flex size-10 items-center justify-center rounded-xl text-white shadow-sm"
                        style={{ backgroundColor: deck.color || "#0f766e" }}
                      >
                        <Layers3 className="size-5" />
                      </span>
                      <Badge variant="secondary">{deck.stats.total} كارت</Badge>
                    </div>
                    <p className="mt-3 font-bold text-sm text-foreground">{deck.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      جديد {deck.stats.new} · بتراجع {deck.stats.learning} · متقن {deck.stats.mastered}
                    </p>
                  </button>
                ))}
              </aside>

              {selected && <DeckWorkspace deck={selected} onDone={refresh} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeckCreator({ onDone }: { onDone: () => Promise<unknown> }) { const [title, setTitle] = useState(""), [description, setDescription] = useState(""); const mutation = trpc.flashcards.createDeck.useMutation({ onSuccess: async () => { setTitle(""); setDescription(""); toast.success("المجموعة جاهزة، يلا حط أول كارت."); await onDone(); }, onError: e => toast.error(errorText(e)) }); return <div className="surface mt-5 flex flex-col gap-3 p-4 md:flex-row"><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="اسم المجموعة: أحياء الفصل الأول" /><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="وصف اختياري" /><Button disabled={!title.trim() || mutation.isPending} onClick={() => mutation.mutate({ title: title.trim(), description: description.trim() || undefined })}><Plus />مجموعة جديدة</Button></div>; }

function DeckWorkspace({ deck, onDone }: { deck: any; onDone: () => Promise<unknown> }) { const [index, setIndex] = useState(0), [revealed, setRevealed] = useState(false); const [prompt, setPrompt] = useState(""), [answer, setAnswer] = useState(""); const cards = deck.cards ?? []; const card = cards[index % Math.max(cards.length, 1)];
  const add = trpc.flashcards.create.useMutation({ onSuccess: async () => { setPrompt(""); setAnswer(""); toast.success("الكارت اتضاف. جامد!"); await onDone(); }, onError: e => toast.error(errorText(e)) });
  const review = trpc.flashcards.review.useMutation({ onSuccess: async () => { setRevealed(false); setIndex(value => value + 1); await onDone(); }, onError: e => toast.error(errorText(e)) });
  const remove = trpc.flashcards.delete.useMutation({ onSuccess: async () => { setIndex(0); toast.success("الكارت اتمسح."); await onDone(); }, onError: e => toast.error(errorText(e)) });
  return <section className="space-y-5"><div className="surface overflow-hidden p-6"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold tracking-[.13em] text-primary">ACTIVE RECALL</p><h2 className="mt-1 text-xl font-extrabold">{deck.title}</h2></div><Badge variant="secondary">{cards.length ? `${(index % cards.length) + 1} / ${cards.length}` : "مفيش كروت"}</Badge></div>{card ? <><button onClick={() => setRevealed(value => !value)} className="flex min-h-64 w-full flex-col items-center justify-center rounded-3xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-violet-500/10 p-8 text-center"><Brain className="mb-4 size-10 text-primary" /><p className="text-sm text-muted-foreground">{revealed ? "الإجابة" : "السؤال — حاول تفتكر قبل ما تقلب"}</p><p className="mt-3 max-w-xl text-xl font-bold leading-9">{revealed ? card.answer : card.prompt}</p><p className="mt-6 text-xs text-primary">اضغط على الكارت للقلب</p></button>{revealed && <div className="mt-4 grid gap-2 sm:grid-cols-3"><Button variant="outline" disabled={review.isPending} onClick={() => review.mutate({ cardId: card.id, result: "again" })}><RefreshCw />تاني بكرة</Button><Button variant="secondary" disabled={review.isPending} onClick={() => review.mutate({ cardId: card.id, result: "good" })}><Sparkles />فاكرها</Button><Button disabled={review.isPending} onClick={() => review.mutate({ cardId: card.id, result: "mastered" })}><CheckCircle2 />متقن</Button></div>}<Button className="mt-3" variant="ghost" onClick={() => remove.mutate({ cardId: card.id })}><Trash2 className="size-4" />حذف الكارت</Button></> : <div className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">اكتب أول سؤال وإجابته تحت، وبعدها ذاكر بشكل أذكى مش أكتر.</div>}</div><div className="surface p-5"><div className="mb-4 flex items-center gap-2"><Plus className="size-5 text-primary" /><h2 className="font-bold">كارت جديد</h2></div><Textarea value={prompt} onChange={e => setPrompt(e.target.value)} className="min-h-24" placeholder="السؤال أو المعلومة اللي عايز تحفظها" /><Textarea value={answer} onChange={e => setAnswer(e.target.value)} className="mt-3 min-h-24" placeholder="الإجابة أو الشرح المختصر" /><Button className="mt-4" disabled={!prompt.trim() || !answer.trim() || add.isPending} onClick={() => add.mutate({ deckId: deck.id, prompt: prompt.trim(), answer: answer.trim() })}><Plus />إضافة كارت</Button></div></section>; }
