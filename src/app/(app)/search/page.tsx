import { requireUser, can } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { recentSearches } from "@/lib/search";
import { SearchView } from "./search-view";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const [{ t, lang }, { q }, recent] = await Promise.all([getDict(), searchParams, recentSearches(user.tenantId, 30)]);
  return <SearchView t={t} lang={lang} canDecide={can.decide(user.role)} initialQuery={q ?? ""} recent={recent} />;
}
