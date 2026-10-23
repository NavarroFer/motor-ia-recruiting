import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { CandidatesView } from "./candidates-view";

export default async function CandidatesPage() {
  await requireUser();
  const { t, lang } = await getDict();
  return <CandidatesView t={t} lang={lang} />;
}
