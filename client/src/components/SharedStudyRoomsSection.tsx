import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  Plus,
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  BookOpen,
  Laptop,
  GraduationCap,
  Video,
  Globe,
  Share2,
  TrendingUp,
  UserPlus,
  ArrowRight,
  Download,
  Clock,
  Award,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

export function SharedStudyRoomsSection() {
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isAddingResource, setIsAddingResource] = useState(false);

  // Form states
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");

  // Resource form
  const [resTitle, setResTitle] = useState("");
  const [resPlatform, setResPlatform] = useState("Udemy");
  const [resUrl, setResUrl] = useState("");
  const [resSubject, setResSubject] = useState("عام");

  // User progress update state per resource
  const [editingResId, setEditingResId] = useState<number | null>(null);
  const [progressVal, setProgressVal] = useState<number>(0);
  const [minsVal, setMinsVal] = useState<number>(0);

  const utils = trpc.useContext();
  const { data: userRooms, isLoading: isRoomsLoading } = trpc.studyRooms.listUserRooms.useQuery();

  const { data: roomDetails, isLoading: isDetailsLoading } = trpc.studyRooms.getDetails.useQuery(
    { roomId: selectedRoomId! },
    { enabled: !!selectedRoomId }
  );

  const createRoomMutation = trpc.studyRooms.create.useMutation({
    onSuccess: (data) => {
      utils.studyRooms.listUserRooms.invalidate();
      setIsCreatingRoom(false);
      setRoomName("");
      setRoomDesc("");
      setCustomCode("");
      setSelectedRoomId(data.roomId);
      toast.success(`تم إنشاء الغرفة الدراسية بنجاح! كود الغرفة: ${data.roomCode} 🎉`);
    },
    onError: (err) => toast.error(err.message || "فشل إنشاء الغرفة."),
  });

  const joinRoomMutation = trpc.studyRooms.join.useMutation({
    onSuccess: (data) => {
      utils.studyRooms.listUserRooms.invalidate();
      setIsJoiningRoom(false);
      setJoinCodeInput("");
      setSelectedRoomId(data.roomId);
      toast.success(`تم الانضمام للغرفة الدراسية "${data.name}" بنجاح! ✨`);
    },
    onError: (err) => toast.error(err.message || "فشل الانضمام للغرفة."),
  });

  const addResourceMutation = trpc.studyRooms.addResource.useMutation({
    onSuccess: () => {
      if (selectedRoomId) utils.studyRooms.getDetails.invalidate({ roomId: selectedRoomId });
      setIsAddingResource(false);
      setResTitle("");
      setResUrl("");
      setResSubject("عام");
      toast.success("تمت إضافة الكورس المشترك لغرفة الدراسة!");
    },
  });

  const updateProgressMutation = trpc.studyRooms.updateProgress.useMutation({
    onSuccess: () => {
      if (selectedRoomId) utils.studyRooms.getDetails.invalidate({ roomId: selectedRoomId });
      setEditingResId(null);
      toast.success("تم تحديث تقدمك في الدورة بنجاح! سيتم إخطار الأصدقاء. 🚀");
    },
  });

  const importToBridgeMutation = trpc.studyRooms.importToBridge.useMutation({
    onSuccess: (res) => {
      utils.resourceBridge.list.invalidate();
      toast.success(res.message);
    },
  });

  const [copiedCode, setCopiedCode] = useState(false);
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success(`تم نسخ كود الغرفة (${code}) لحافظة الجهاز!`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const activeRoom = userRooms?.find((r: any) => r.id === selectedRoomId);

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* ROOMS NAVIGATION & ACTION BAR */}
      <div className="surface p-6 rounded-3xl border bg-gradient-to-br from-card via-card to-primary/5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
              <Users className="size-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">غرف الدراسة ومشاركة المصادر (Shared Study Rooms)</h3>
              <p className="text-xs text-muted-foreground">أنشئ غرفاً جماعية مع أصدقائك لمتابعة تقدم بعضكم البعض في نفس الدورات الكورسات الخارجية.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => setIsJoiningRoom(!isJoiningRoom)} variant="outline" className="rounded-2xl text-xs font-bold gap-1.5">
              <UserPlus className="size-4 text-primary" /> الانضمام بكود
            </Button>
            <Button onClick={() => setIsCreatingRoom(!isCreatingRoom)} className="rounded-2xl text-xs font-extrabold gap-1.5 shadow-md shadow-primary/20">
              <Plus className="size-4" /> إنشاء غرفة جديدة
            </Button>
          </div>
        </div>

        {/* Create Room Form Drawer */}
        {isCreatingRoom && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!roomName.trim()) return toast.error("يرجى كتابة اسم الغرفة.");
              createRoomMutation.mutate({ name: roomName, description: roomDesc, customCode });
            }}
            className="p-5 rounded-2xl border border-primary/30 bg-card space-y-3 animate-in fade-in"
          >
            <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
              <Users className="size-4" /> إنشاء غرفة دراسية مشتركة جديدة
            </h4>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">اسم الغرفة الدراسية *</label>
                <Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="مثال: ممر برمجيات الذكاء الاصطناعي 2026" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">رمز الغرفة المخصص (اختياري)</label>
                <Input value={customCode} onChange={(e) => setCustomCode(e.target.value)} placeholder="مثال: AI-MASTERS (أترك فارغاً للتوليد التلقائي)" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-muted-foreground block mb-1">وصف الغرفة أو الهدف منها</label>
                <Input value={roomDesc} onChange={(e) => setRoomDesc(e.target.value)} placeholder="مثال: نتابع هنا كورسات Udemy وCoursera معاً خطوة بخطوة..." />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreatingRoom(false)}>
                إلغاء
              </Button>
              <Button type="submit" size="sm" disabled={createRoomMutation.isPending} className="font-bold">
                حفظ وإنشاء الغرفة
              </Button>
            </div>
          </form>
        )}

        {/* Join Room Form Drawer */}
        {isJoiningRoom && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!joinCodeInput.trim()) return toast.error("يرجى إدخال رمز الغرفة.");
              joinRoomMutation.mutate({ roomCode: joinCodeInput });
            }}
            className="p-5 rounded-2xl border border-indigo-500/30 bg-card space-y-3 animate-in fade-in"
          >
            <h4 className="font-bold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <UserPlus className="size-4" /> الانضمام لغرفة دراسية موجودة
            </h4>

            <div className="flex items-center gap-3">
              <Input
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                placeholder="أدخل رمز الغرفة (مثال: ROOM-8A2F)"
                className="font-mono uppercase font-bold text-sm"
              />
              <Button type="submit" disabled={joinRoomMutation.isPending} className="font-bold shrink-0">
                انضمام الآن
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIsJoiningRoom(false)}>
                إلغاء
              </Button>
            </div>
          </form>
        )}

        {/* User Rooms List Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="text-xs font-bold text-muted-foreground mr-1">غرفك الدراسية:</span>
          {isRoomsLoading ? (
            <span className="text-xs text-muted-foreground">جارٍ تحميل الغرف...</span>
          ) : userRooms && userRooms.length > 0 ? (
            userRooms.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoomId(r.id)}
                className={`px-4 py-2 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2 ${
                  selectedRoomId === r.id
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 border-primary"
                    : "bg-card hover:border-primary/40 text-foreground"
                }`}
              >
                <Users className="size-3.5" />
                <span>{r.name}</span>
                <span className="bg-background/20 px-1.5 py-0.5 rounded-full text-[10px] font-mono">
                  {r.memberCount} أعضاء
                </span>
              </button>
            ))
          ) : (
            <span className="text-xs text-muted-foreground bg-muted/60 px-3 py-1 rounded-xl">
              لم تنضم لأي غرفة دراسية بعد. قم بإنشاء أول غرفة أو انضم لغرفة صديقك!
            </span>
          )}
        </div>
      </div>

      {/* ACTIVE ROOM WORKSPACE VIEW */}
      {selectedRoomId && roomDetails ? (
        <div className="space-y-6">
          {/* ROOM HEADER CARD */}
          <div className="surface p-6 rounded-3xl border space-y-4 bg-card">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-xl text-primary">{roomDetails.room.name}</h3>
                  <button
                    onClick={() => handleCopyCode(roomDetails.room.roomCode)}
                    className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full text-xs font-mono font-bold hover:bg-primary/20 transition-all"
                  >
                    {copiedCode ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    <span>{roomDetails.room.roomCode}</span>
                  </button>
                </div>
                {roomDetails.room.description && <p className="text-xs text-muted-foreground">{roomDetails.room.description}</p>}
              </div>

              <Button
                onClick={() => setIsAddingResource(!isAddingResource)}
                size="sm"
                className="rounded-2xl text-xs font-bold gap-1 shadow-md shadow-primary/20"
              >
                <Plus className="size-4" /> شارك كورساً جديداً بالغرفة
              </Button>
            </div>

            {/* Members Row */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-muted-foreground">أعضاء الغرفة ({roomDetails.members.length}):</span>
              {roomDetails.members.map((m: any) => (
                <span key={m.id} className="bg-muted px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 border">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  {m.userName}
                  {m.userId === roomDetails.room.createdByUserId && <span className="text-[10px] text-primary">(المشرف)</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Add Resource to Room Drawer */}
          {isAddingResource && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!resTitle.trim() || !resUrl.trim()) return toast.error("يرجى كتابة عنوان ورابط الكورس.");
                addResourceMutation.mutate({
                  roomId: selectedRoomId,
                  title: resTitle,
                  platform: resPlatform,
                  url: resUrl,
                  subject: resSubject,
                });
              }}
              className="surface p-5 rounded-3xl border border-primary/30 bg-card space-y-4 animate-in fade-in"
            >
              <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
                <Plus className="size-4" /> مشاركة كورس خارجي مع أعضاء الغرفة
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">عنوان الدورة الخارجية *</label>
                  <Input value={resTitle} onChange={(e) => setResTitle(e.target.value)} placeholder="مثال: Master Machine Learning on Udemy" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">رابط الكورس المباشر *</label>
                  <Input value={resUrl} onChange={(e) => setResUrl(e.target.value)} placeholder="https://udemy.com/course/..." />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">المنصة المضيفة</label>
                  <select
                    value={resPlatform}
                    onChange={(e) => setResPlatform(e.target.value)}
                    className="w-full h-9 rounded-xl border bg-card px-3 text-xs font-bold"
                  >
                    <option value="Udemy">Udemy</option>
                    <option value="Coursera">Coursera</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Abwab">منصة أبواب</option>
                    <option value="Edvanya">إد فانيا</option>
                    <option value="Khan Academy">Khan Academy</option>
                    <option value="منصة خاصة">منصة مدرس خاصة</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">المادة / المجال</label>
                  <Input value={resSubject} onChange={(e) => setResSubject(e.target.value)} placeholder="مثال: ذكاء اصطناعي، رياضيات" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingResource(false)}>
                  إلغاء
                </Button>
                <Button type="submit" size="sm" disabled={addResourceMutation.isPending} className="font-bold">
                  نشر الكورس بالغرفة
                </Button>
              </div>
            </form>
          )}

          {/* SHARED COURSES & FRIENDS PROGRESS COMPARISON */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="font-extrabold text-base flex items-center gap-2">
                <BookOpen className="size-5 text-primary" />
                <span>الدورات الخارجية المشتركة ومتابعة إنجاز الأصدقاء ({roomDetails.resources.length})</span>
              </h4>
            </div>

            {roomDetails.resources.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2">
                {roomDetails.resources.map((resItem: any) => {
                  const resProgressList = roomDetails.progressList.filter((p: any) => p.roomResourceId === resItem.id);

                  return (
                    <div key={resItem.id} className="surface p-5 rounded-3xl border space-y-4 bg-card flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border bg-primary/10 text-primary">
                            {resItem.platform}
                          </span>
                          <span className="text-[11px] text-muted-foreground">تمت الإضافة بواسطة: {resItem.addedByName}</span>
                        </div>

                        <h5 className="font-black text-base text-foreground leading-snug">{resItem.title}</h5>

                        <div className="flex items-center justify-between pt-1">
                          <a href={resItem.url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="h-7 text-xs font-bold gap-1 rounded-xl">
                              <ExternalLink className="size-3" /> رابط الكورس
                            </Button>
                          </a>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => importToBridgeMutation.mutate({ roomResourceId: resItem.id })}
                            disabled={importToBridgeMutation.isPending}
                            className="h-7 text-xs font-bold gap-1 rounded-xl text-primary"
                          >
                            <Download className="size-3" /> أضف لمصادري الشخصية
                          </Button>
                        </div>
                      </div>

                      {/* FRIENDS PROGRESS MATRIX */}
                      <div className="border-t pt-3 space-y-2.5 bg-muted/20 -mx-5 -mb-5 p-5 rounded-b-3xl">
                        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="size-3.5 text-primary" /> تقدم الأصدقاء في هذه الدورة:
                          </span>
                          <button
                            onClick={() => {
                              setEditingResId(resItem.id);
                              const myProg = resProgressList.find((p: any) => p.userId === 1)?.progressPercent || 0;
                              setProgressVal(myProg);
                            }}
                            className="text-primary hover:underline font-extrabold"
                          >
                            ✏️ تحديث تقدمي
                          </button>
                        </div>

                        {/* Update Progress Slider Box */}
                        {editingResId === resItem.id && (
                          <div className="p-3 rounded-2xl bg-card border space-y-3 animate-in fade-in">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span>حدد نسبة إنجازك الحالية:</span>
                              <span className="text-primary font-black text-sm">{progressVal}%</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={progressVal}
                              onChange={(e) => setProgressVal(Number(e.target.value))}
                              className="w-full accent-primary"
                            />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditingResId(null)}>
                                إلغاء
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  updateProgressMutation.mutate({
                                    roomId: selectedRoomId,
                                    roomResourceId: resItem.id,
                                    progressPercent: progressVal,
                                  })
                                }
                                disabled={updateProgressMutation.isPending}
                                className="font-bold text-xs"
                              >
                                حفظ التقدم
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Members Progress Bars */}
                        <div className="space-y-2">
                          {resProgressList.length > 0 ? (
                            resProgressList.map((prog: any) => (
                              <div key={prog.id} className="space-y-1 text-xs">
                                <div className="flex items-center justify-between font-bold">
                                  <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-primary" /> {prog.userName}
                                  </span>
                                  <span className="text-primary font-extrabold">{prog.progressPercent}%</span>
                                </div>
                                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-500"
                                    style={{ width: `${prog.progressPercent}%` }}
                                  />
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] text-muted-foreground text-center py-1">لم يقم الأصدقاء بتسجيل تقدمهم بعد.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="surface p-10 rounded-3xl border border-dashed text-center space-y-3 bg-card">
                <Users className="size-8 mx-auto text-muted-foreground" />
                <h5 className="font-bold text-sm">لا توجد كورسات مشتركة في هذه الغرفة بعد</h5>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  قم بمشاركة أول كورس من Udemy أو Coursera مع أصدقائك في هذه الغرفة لمتابعة إنجازكم معاً!
                </p>
                <Button size="sm" onClick={() => setIsAddingResource(true)} className="font-bold text-xs gap-1">
                  <Plus className="size-3.5" /> مشاركة كورس الآن
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="surface p-12 rounded-3xl border border-dashed text-center space-y-3 bg-card">
          <Users className="size-10 mx-auto text-primary animate-pulse" />
          <h4 className="font-extrabold text-base">اختر أو أنشئ غرفة دراسية لمتابعة تقدم أصدقائك</h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            يمكنك إنشاء غرفة مشتركة وإرسال رمز الغرفة لأصدقائك في المدرسة أو الجامعة لمشاركة نفس الكورسات والتعلم التنافسي.
          </p>
        </div>
      )}
    </div>
  );
}
