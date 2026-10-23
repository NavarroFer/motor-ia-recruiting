import { requireUser, can } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { OpeningDetail } from "./opening-detail";

export default async function OpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { t, lang } = await getDict();
  const { id } = await params;
  return <OpeningDetail id={id} t={t} lang={lang} canEdit={can.decide(user.role)} />;
}
