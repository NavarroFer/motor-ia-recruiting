import { getSession } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { InlineSvg } from "@/components/brand/inline-svg";
import { SplashTransition } from "./splash-transition";

// Splash de entrada (06_Applications/World_Teams_Splash + 07_Motion): aparece el nombre,
// entra el mundo y, al terminar, la escena sale automáticamente.
export default async function Welcome() {
  const [{ t }, user] = await Promise.all([getDict(), getSession()]);
  return (
    <SplashTransition href={user ? "/" : "/login"} className="wt-splash relative flex min-h-screen flex-col overflow-hidden bg-primary px-[clamp(20px,3.4vw,54px)] pt-8 pb-7 text-cream">
      <header className="flex items-center justify-between text-xs">
        <span className="font-bold tracking-wide">WORLD TEAMS</span>
        <span className="uppercase tracking-wide">{t.shell.tagline}</span>
      </header>

      <div className="relative grid flex-1 grid-cols-1 items-center gap-8 md:grid-cols-[1.55fr_1fr]">
        <InlineSvg file="World_Teams_Stacked_Cream.svg" label="World Teams" className="w-full max-w-[860px]" />
        <InlineSvg file="illustrations/globe_Cream.svg" className="splash-globe mx-auto w-[min(34vw,560px)] max-md:w-[70vw]" />
      </div>

      <div className="flex items-end gap-[1.2vw] pb-6">
        <InlineSvg file="illustrations/computer_Cream.svg" className="splash-computer -mb-[1.4vw] w-[clamp(140px,17vw,280px)]" />
        <InlineSvg file="illustrations/windows_Cream.svg" className="splash-windows mb-[1vw] w-[clamp(80px,8.5vw,140px)]" />
        <InlineSvg file="illustrations/cursor_Cream.svg" className="splash-cursor mb-[2.2vw] w-[clamp(44px,5vw,80px)]" />
      </div>

      <footer className="flex items-end gap-12">
        <div className="flex-1">
          <div className="splash-rule h-px origin-left bg-cream/80" />
          <div className="mt-4 text-[13px]">world teams</div>
        </div>
      </footer>
    </SplashTransition>
  );
}
