import { getDict } from "@/lib/i18n";
import { InlineSvg } from "@/components/brand/inline-svg";
import { Illo } from "@/components/brand/brand";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { t, lang } = await getDict();
  return (
    <div className="grid min-h-screen md:grid-cols-[47%_1fr]">
      <aside className="wt-splash sticky top-0 hidden h-screen flex-col overflow-hidden bg-primary px-14 pt-14 pb-12 text-cream md:flex">
        <InlineSvg file="World_Teams_Stacked_Cream.svg" label="World Teams" className="w-[250px]" />
        <p className="mt-[8vh] animate-wt-enter text-[28px] leading-[1.65] font-bold [animation-delay:0.3s]">{t.login.hero1}<br />{t.login.hero2}</p>
        <InlineSvg file="illustrations/globe_Cream.svg" className="splash-globe mx-auto mt-[5vh] w-[min(24vw,34vh,400px)]" />
        <div className="mt-auto flex items-end justify-between gap-6">
          <div>
            <Illo name="computer" tone="cream" className="mb-8 w-[min(160px,15vh)] animate-wt-enter [animation-delay:0.6s]" />
            <p className="text-sm font-bold">{t.shell.footer}</p>
          </div>
        </div>
      </aside>
      <main className="flex min-h-screen flex-col bg-paper px-6 md:px-[8.3%]">
        <LoginForm t={t} lang={lang} />
      </main>
    </div>
  );
}
