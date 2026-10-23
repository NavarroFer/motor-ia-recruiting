import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { UsersView } from "./users-view";

export default async function UsersPage() {
  const me = await requireUser(["admin"]);
  const { t, lang } = await getDict();
  return <UsersView t={t} lang={lang} meId={me.id} />;
}
