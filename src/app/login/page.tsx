import { getDict } from "@/lib/i18n";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { t, lang } = await getDict();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <LoginForm t={t} lang={lang} />
    </div>
  );
}
