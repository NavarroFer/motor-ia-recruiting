import { requireUser, can } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { OpeningsView } from "./openings-view";

export default async function OpeningsPage() {
  const user = await requireUser();
  const { t, lang } = await getDict();
  return <OpeningsView t={t} lang={lang} canEdit={can.decide(user.role)} />;
}
