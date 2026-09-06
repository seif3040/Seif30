import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Database,
  Upload,
  Download,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  HardDrive,
  TableProperties,
  Link,
  Zap,
  ArrowRight,
} from "lucide-react";

type DbStats = {
  success: boolean;
  totalTables: number;
  totalRows: number;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  tables: Record<string, number>;
};

const TABLE_TRANSLATIONS: Record<string, string> = {
  tasks: "المهام اليومية (tasks)",
  subjects: "المواد الدراسية (subjects)",
  chapters: "الفصول والأبواب (chapters)",
  lessons: "الدروس (lessons)",
  lessonProgress: "تقدم الدروس (lessonProgress)",
  notes: "الملاحظات (notes)",
  notebooks: "دفاتر الملاحظات (notebooks)",
  flashcards: "الفلاش كاردز (flashcards)",
  flashcardDecks: "مجموعات البطاقات (flashcardDecks)",
  habits: "العادات اليومية (habits)",
  habitCompletions: "إنجاز العادات (habitCompletions)",
  goals: "الأهداف (goals)",
  exams: "الامتحانات والاختبارات (exams)",
  studyVideoSessions: "جلسات فيديو المذاكرة (studyVideoSessions)",
  videoNotes: "ملاحظات الفيديوهات (videoNotes)",
  pomodoroSessions: "جلسات البومودورو (pomodoroSessions)",
  coinTransactions: "سجل الكوينز (coinTransactions)",
  achievements: "الإنجازات (achievements)",
  userAchievements: "إنجازات المستخدم (userAchievements)",
  rewards: "المكافآت (rewards)",
  rewardPurchases: "مشتريات المكافآت (rewardPurchases)",
  calendarEvents: "أحداث التقويم (calendarEvents)",
  studyCycles: "دورات المذاكرة (studyCycles)",
  dailyStudySummaries: "الملخصات اليومية (dailyStudySummaries)",
  lessonSources: "مصادر الدروس (lessonSources)",
  assistantMessages: "رسائل المساعد (assistantMessages)",
};

export function ManusDataMigration() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeMethod, setActiveMethod] = useState<"direct_mysql" | "file_db" | "csv_import" | "json_paste">("direct_mysql");

  // Direct MySQL Connection State
  const [connectionUrl, setConnectionUrl] = useState("");
  const [host, setHost] = useState("gateway05.us-east-1.prod.aws.tidbcloud.com");
  const [port, setPort] = useState("4000");
  const [username, setUsername] = useState("3XyE8VUu6Ew6yf9.6771f0b0d8d4");
  const [password, setPassword] = useState("");
  const [useSeparateFields, setUseSeparateFields] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [migratingMysql, setMigratingMysql] = useState(false);
  const [remoteStats, setRemoteStats] = useState<any>(null);

  // CSV State
  const [selectedTable, setSelectedTable] = useState<string>("tasks");
  const [csvContent, setCsvContent] = useState("");
  const [csvFileName, setCsvFileName] = useState("");

  // JSON State
  const [jsonContent, setJsonContent] = useState("");
  const [jsonTable, setJsonTable] = useState<string>("auto");

  // DB File upload state
  const [dbFile, setDbFile] = useState<File | null>(null);
  const [uploadingDb, setUploadingDb] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/migration/status");
      const data = await res.json();
      if (data.success) {
        setStats(data);
      }
    } catch {
      toast.error("تعذر جلب إحصائيات قاعدة البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Handle Direct MySQL Test / Migrate
  const handleMysqlAction = async (action: "test" | "migrate") => {
    const payload: any = { action };

    if (!useSeparateFields) {
      if (!connectionUrl.trim()) {
        toast.error("يرجى لصق رابط Connection URL من نافذة Manage Database.");
        return;
      }
      payload.connectionUrl = connectionUrl.trim();
    } else {
      if (!host || !username || !password) {
        toast.error("يرجى إدخال اسم المضيف واسم المستخدم وكلمة المرور.");
        return;
      }
      payload.host = host.trim();
      payload.port = port ? Number(port) : 4000;
      payload.user = username.trim();
      payload.password = password.trim();
    }

    try {
      if (action === "test") setTestingConnection(true);
      if (action === "migrate") setMigratingMysql(true);

      const res = await fetch("/api/migration/connect-mysql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        if (action === "test") {
          toast.success("تم الاتصال بنجاح! تم العثور على جداولك وبياناتك.");
          setRemoteStats(data);
        } else {
          toast.success(data.message || "تم نقل جميع البيانات بنجاح!");
          fetchStatus();
        }
      } else {
        toast.error(data.message || "تعذر الاتصال بقاعدة البيانات.");
      }
    } catch (err: any) {
      toast.error("حدث خطأ في الاتصال: " + err.message);
    } finally {
      setTestingConnection(false);
      setMigratingMysql(false);
    }
  };

  // Handle SQLite file upload (.db)
  const handleUploadDbFile = async () => {
    if (!dbFile) {
      toast.error("يرجى اختيار ملف قاعدة البيانات study_os.db أولاً.");
      return;
    }

    try {
      setUploadingDb(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const res = await fetch("/api/migration/upload-db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64: base64 }),
        });

        const data = await res.json();
        if (data.success) {
          toast.success(data.message || "تم نقل قاعدة البيانات بنجاح!");
          setDbFile(null);
          fetchStatus();
        } else {
          toast.error(data.message || "فشل استيراد قاعدة البيانات.");
        }
        setUploadingDb(false);
      };
      reader.readAsArrayBuffer(dbFile);
    } catch (err: any) {
      setUploadingDb(false);
      toast.error("حدث خطأ أثناء قراءة الملف: " + err.message);
    }
  };

  // Handle CSV file selection
  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const inferred = file.name.replace(/\.csv$/i, "").trim();
    if (TABLE_TRANSLATIONS[inferred]) {
      setSelectedTable(inferred);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCsvContent(reader.result as string);
    };
    reader.readAsText(file);
  };

  // Submit CSV
  const handleImportCsv = async () => {
    if (!csvContent.trim()) {
      toast.error("يرجى إدخال أو رفع محتوى ملف CSV.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/migration/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: selectedTable,
          csvContent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setCsvContent("");
        setCsvFileName("");
        fetchStatus();
      } else {
        toast.error(data.message || "فشل استيراد ملف CSV.");
      }
    } catch (err: any) {
      toast.error("خطأ في الاتصال: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit JSON
  const handleImportJson = async () => {
    if (!jsonContent.trim()) {
      toast.error("يرجى لصق بيانات JSON للاستيراد.");
      return;
    }

    try {
      let parsed: any;
      try {
        parsed = JSON.parse(jsonContent);
      } catch {
        toast.error("صيغة JSON غير صالحة، يرجى التأكد من صحة النص.");
        return;
      }

      setLoading(true);
      const payload: any = { data: parsed };
      if (jsonTable !== "auto") {
        payload.table = jsonTable;
      }

      const res = await fetch("/api/migration/import-json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setJsonContent("");
        fetchStatus();
      } else {
        toast.error(data.message || "فشل استيراد بيانات JSON.");
      }
    } catch (err: any) {
      toast.error("خطأ: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportAll = () => {
    window.open("/api/migration/export-all", "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="surface p-6 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
              <Zap className="size-7" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">نقل وترحيل بياناتك من مانوس (Manus / TiDB)</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                اسحب جميع بياناتك السابقة بضغطة زر واحدة عبر رابط الاتصال أو الملفات.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStatus}
              disabled={loading}
              className="gap-2 rounded-xl font-bold"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportAll}
              className="gap-2 rounded-xl font-bold"
            >
              <Download className="size-4" />
              نسخة احتياطية
            </Button>
          </div>
        </div>

        {/* Database Quick Stats */}
        {stats && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border/60 pt-4">
            <div className="rounded-2xl bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground font-semibold">إجمالي الجداول</p>
              <p className="text-lg font-black text-primary mt-0.5">{stats.totalTables} جدول</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground font-semibold">السجلات في نظامك الحالي</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.totalRows} سجل</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground font-semibold">حجم القاعدة المحلية</p>
              <p className="text-lg font-black mt-0.5">{stats.fileSizeFormatted}</p>
            </div>
            <div className="rounded-2xl bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground font-semibold">حالة الربط السحابي</p>
              <div className="flex items-center justify-center gap-1.5 mt-1 text-xs font-bold text-emerald-600">
                <CheckCircle2 className="size-3.5" />
                <span>Firestore متصل</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Migration Action Tabs */}
      <Tabs value={activeMethod} onValueChange={(v) => setActiveMethod(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 rounded-2xl p-1 bg-muted/60">
          <TabsTrigger value="direct_mysql" className="rounded-xl font-bold gap-2 text-xs sm:text-sm">
            <Zap className="size-4 text-amber-500" />
            1. اتصال مباشر بالرابط (الأسرع)
          </TabsTrigger>
          <TabsTrigger value="file_db" className="rounded-xl font-bold gap-2 text-xs sm:text-sm">
            <HardDrive className="size-4" />
            2. رفع study_os.db
          </TabsTrigger>
          <TabsTrigger value="csv_import" className="rounded-xl font-bold gap-2 text-xs sm:text-sm">
            <FileSpreadsheet className="size-4" />
            3. استيراد CSV
          </TabsTrigger>
          <TabsTrigger value="json_paste" className="rounded-xl font-bold gap-2 text-xs sm:text-sm">
            <FileCode className="size-4" />
            4. لصق JSON
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Direct MySQL Connection URL (From User's Screenshot!) */}
        <TabsContent value="direct_mysql" className="mt-4">
          <div className="surface p-6 rounded-3xl border border-border/80 space-y-5">
            <div className="flex items-start gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4">
              <Zap className="size-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs leading-relaxed space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-300">
                  السحب المباشر من نافذة "Manage Database" الظاهرة في صورتك:
                </p>
                <p className="text-muted-foreground">
                  في النافذة التي فتحتها، انقر على أيقونة النسخ بجوار <strong>Connection URL</strong>، ثم الصقه هنا واضغط <strong>"بدء السحب والنقل المباشر"</strong> وسيقوم خادمنا بسحب كل المهام والمواد والدروس والملاحظات فوراً!
                </p>
              </div>
            </div>

            {!useSeparateFields ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-muted-foreground">
                    رابط الاتصال (Connection URL) المنسوخ من مانوس:
                  </label>
                  <button
                    type="button"
                    onClick={() => setUseSeparateFields(true)}
                    className="text-xs text-primary underline font-medium"
                  >
                    أو إدخال بيانات المضيف وكلمة المرور يدوياً
                  </button>
                </div>
                <Input
                  dir="ltr"
                  value={connectionUrl}
                  onChange={(e) => setConnectionUrl(e.target.value)}
                  placeholder="mysql://3XyE8VUu6Ew6yf9.6771f0b0d8d4:PASSWORD@gateway05.us-east-1.prod.aws.tidbcloud.com:4000/db_name"
                  className="h-12 font-mono text-xs rounded-xl"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">إدخال الحقول منفصلة:</span>
                  <button
                    type="button"
                    onClick={() => setUseSeparateFields(false)}
                    className="text-xs text-primary underline font-medium"
                  >
                    الرجوع إلى لصق Connection URL
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground">Server Host</label>
                    <Input
                      dir="ltr"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      className="h-10 font-mono text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground">Port</label>
                    <Input
                      dir="ltr"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className="h-10 font-mono text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground">Username</label>
                    <Input
                      dir="ltr"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="h-10 font-mono text-xs rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 text-muted-foreground">Password (كلمة المرور المنسوخة)</label>
                    <Input
                      dir="ltr"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="انسخ Password من النافذة"
                      className="h-10 font-mono text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                variant="outline"
                disabled={testingConnection || migratingMysql}
                onClick={() => handleMysqlAction("test")}
                className="h-11 rounded-2xl font-bold gap-2 text-xs sm:text-sm"
              >
                {testingConnection ? <RefreshCw className="size-4 animate-spin" /> : <Link className="size-4" />}
                1. فحص الاتصال وقراءة الجداول
              </Button>
              <Button
                disabled={testingConnection || migratingMysql}
                onClick={() => handleMysqlAction("migrate")}
                className="h-11 rounded-2xl font-bold gap-2 flex-1 text-xs sm:text-sm shadow-md"
              >
                {migratingMysql ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" />
                    جارٍ سحب ونقل جميع البيانات إلى نظامك...
                  </>
                ) : (
                  <>
                    <Zap className="size-4" />
                    2. بدء السحب والنقل المباشر لجميع البيانات الآن
                  </>
                )}
              </Button>
            </div>

            {/* Remote Inspection Results */}
            {remoteStats && (
              <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300">
                    تم الاتصال بنجاح! تم العثور على {remoteStats.totalTables} جدول و {remoteStats.totalRecords} سجل في مانوس:
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {Object.entries(remoteStats.tables || {})
                    .filter(([_, c]: any) => c > 0)
                    .map(([tbl, c]: any) => (
                      <div key={tbl} className="bg-background/80 p-2 rounded-xl border border-border/60 flex items-center justify-between">
                        <span className="font-medium truncate max-w-[120px]">{TABLE_TRANSLATIONS[tbl] || tbl}</span>
                        <span className="font-bold text-emerald-600">{c}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Direct study_os.db Upload */}
        <TabsContent value="file_db" className="mt-4">
          <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
            <div>
              <h3 className="font-bold text-base">رفع وتطبيق ملف قاعدة البيانات SQLite الكامل</h3>
              <p className="text-xs text-muted-foreground mt-1">
                هذا الخيار ينقل كل شيء دفعة واحدة (المستخدمين، المواد، الدروس، المهام، الاستراحات، الكوينز، والإنجازات).
              </p>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-border/80 p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                id="db-file-input"
                accept=".db,.sqlite,.sqlite3"
                onChange={(e) => setDbFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label htmlFor="db-file-input" className="cursor-pointer flex flex-col items-center gap-3">
                <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Upload className="size-7" />
                </div>
                {dbFile ? (
                  <div>
                    <p className="font-bold text-sm text-primary">{dbFile.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(dbFile.size / 1024 / 1024).toFixed(2)} MB — انقر لتغيير الملف
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-sm">اسحب أو اختر ملف study_os.db من جهازك</p>
                    <p className="text-xs text-muted-foreground mt-0.5">صيغ SQLite المدعومة: .db, .sqlite</p>
                  </div>
                )}
              </label>
            </div>

            <Button
              disabled={!dbFile || uploadingDb}
              onClick={handleUploadDbFile}
              className="w-full h-12 rounded-2xl font-bold gap-2 text-sm shadow-md"
            >
              {uploadingDb ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  جارٍ فحص واستبدال قاعدة البيانات...
                </>
              ) : (
                <>
                  <Database className="size-4" />
                  بدء الترحيل واستبدال قاعدة البيانات
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Tab 3: CSV Import */}
        <TabsContent value="csv_import" className="mt-4">
          <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
            <div>
              <h3 className="font-bold text-base">استيراد ملف CSV صادر من زر (...) في مانوس</h3>
              <p className="text-xs text-muted-foreground mt-1">
                اختر الجدول المستهدف أو ارفع ملف CSV وسيقوم النظام بالتعرف على الأعمدة واستيراد السجلات تلقائياً.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold mb-1.5 text-muted-foreground">الجدول المستهدف</label>
                <Select value={selectedTable} onValueChange={setSelectedTable}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TABLE_TRANSLATIONS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 text-muted-foreground">اختيار ملف CSV</label>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileSelect}
                  className="h-11 rounded-xl cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5 text-muted-foreground">
                محتوى ملف CSV {csvFileName && `(${csvFileName})`}:
              </label>
              <Textarea
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="id,title,description,priority,status&#10;1,مذاكرة فيزياء,مراجعة الفصل الأول,high,open"
                className="h-36 font-mono text-xs rounded-xl"
                dir="ltr"
              />
            </div>

            <Button
              disabled={!csvContent.trim() || loading}
              onClick={handleImportCsv}
              className="w-full h-11 rounded-2xl font-bold gap-2"
            >
              {loading ? <RefreshCw className="size-4 animate-spin" /> : <Upload className="size-4" />}
              استيراد البيانات إلى جدول {TABLE_TRANSLATIONS[selectedTable] || selectedTable}
            </Button>
          </div>
        </TabsContent>

        {/* Tab 4: JSON Paste */}
        <TabsContent value="json_paste" className="mt-4">
          <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
            <div>
              <h3 className="font-bold text-base">لصق مصفوفة JSON مباشرة</h3>
              <p className="text-xs text-muted-foreground mt-1">
                يمكنك لصق كائن يحتوي على عدة جداول مثل <code>{`{ "tasks": [...], "subjects": [...] }`}</code> أو مصفوفة صفوف لجدول محدد.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5 text-muted-foreground">تحديد الجدول</label>
              <Select value={jsonTable} onValueChange={setJsonTable}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">تعرف تلقائي (Multi-table Object)</SelectItem>
                  {Object.entries(TABLE_TRANSLATIONS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5 text-muted-foreground">نص كود الـ JSON</label>
              <Textarea
                value={jsonContent}
                onChange={(e) => setJsonContent(e.target.value)}
                placeholder={`[\n  {\n    "title": "مذاكرة رياضيات",\n    "priority": "high",\n    "status": "open"\n  }\n]`}
                className="h-44 font-mono text-xs rounded-xl"
                dir="ltr"
              />
            </div>

            <Button
              disabled={!jsonContent.trim() || loading}
              onClick={handleImportJson}
              className="w-full h-11 rounded-2xl font-bold gap-2"
            >
              {loading ? <RefreshCw className="size-4 animate-spin" /> : <FileCode className="size-4" />}
              استيراد مصفوفة JSON
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Current Database Tables Explorer */}
      {stats && (
        <div className="surface p-6 rounded-3xl border border-border/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TableProperties className="size-5 text-primary" />
              <h3 className="font-bold text-base">حالة جميع الجداول في قاعدة بيانات نظامك الحالي</h3>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              إجمالي: {stats.totalRows} سجل
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
            {Object.entries(stats.tables).map(([tableName, count]) => {
              const label = TABLE_TRANSLATIONS[tableName] || tableName;
              return (
                <div
                  key={tableName}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                    count > 0
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-300"
                      : "border-border/60 bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <span className="font-semibold truncate max-w-[180px]" title={label}>
                    {label}
                  </span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                      count > 0
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
