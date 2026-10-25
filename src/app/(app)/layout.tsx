import { requireUser } from "@/lib/auth";
import { one } from "@/lib/db";
import { getDict } from "@/lib/i18n";
import { apiEnabled } from "@/lib/settings";
import { Sidebar } from "@/components/app/sidebar";
import { TopBar } from "@/components/app/page-header";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t, lang } = await getDict();
  const [tenant, apiOn] = await Promise.all([
    one<{ name: string }>("SELECT name FROM tenants WHERE id = $1", [user.tenantId]),
    apiEnabled(),
  ]);
  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} tenant={tenant?.name ?? ""} t={t} lang={lang} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar t={t} apiOn={apiOn} />
        <main className="min-w-0 flex-1 px-10 pt-9 pb-16">{children}</main>
      </div>
    </div>
  );
}
