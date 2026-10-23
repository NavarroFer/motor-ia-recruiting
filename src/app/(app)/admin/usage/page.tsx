import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { UsageView } from "./usage-view";

export default async function UsagePage() {
  await requireUser(["admin"]);
  const { t, lang } = await getDict();
  return <UsageView t={t} lang={lang} />;
}
