import { requireUser, can } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { SearchView } from "./search-view";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { t, lang } = await getDict();
  const { q } = await searchParams;
  return <SearchView t={t} lang={lang} canDecide={can.decide(user.role)} initialQuery={q ?? ""} />;
}
