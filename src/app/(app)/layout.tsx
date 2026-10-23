import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { Sidebar } from "@/components/app/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, lang } = await getDict();
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} t={t} lang={lang} />
      <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
