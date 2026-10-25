import { can, requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { CandidatesView } from "./candidates-view";

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const user = await requireUser();
  const { t, lang } = await getDict();
  const { c } = await searchParams; // ?c=<id> abre la ficha: es el link que viaja en los avisos de Slack
  // Solo afecta la presentación inicial: la API decide qué nombres viajan al cliente.
  return <CandidatesView t={t} lang={lang} canUpload={can.upload(user.role)} anonymized={!can.seeContact(user.role)} initialPanel={c ?? null} />;
}
