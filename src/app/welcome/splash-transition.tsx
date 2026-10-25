"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function SplashTransition({ href, className, children }: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const scene = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scene.current;
    if (!element) return;

    let disposed = false;
    let exit: Animation | undefined;
    router.prefetch(href);

    async function finish() {
      // Wait for the actual intro, excluding the globe's perpetual sway.
      const intro = element!.getAnimations({ subtree: true }).filter(
        (animation) => animation.effect?.getComputedTiming().iterations !== Infinity,
      );
      await Promise.allSettled(intro.map((animation) => animation.finished));
      if (disposed) return;

      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        exit = element!.animate(
          [{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-20px)" }],
          { duration: 500, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" },
        );
        await Promise.allSettled([exit.finished]);
      }
      if (!disposed) router.replace(href);
    }

    void finish();
    return () => {
      disposed = true;
      exit?.cancel();
    };
  }, [href, router]);

  return <div ref={scene} className={className}>{children}</div>;
}
