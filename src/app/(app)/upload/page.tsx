import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { UploadView } from "./upload-view";

export default async function UploadPage() {
  await requireUser(["admin", "recruiter"]);
  const { t, lang } = await getDict();
  return <UploadView t={t} lang={lang} />;
}
