"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/mobile_train", label: "Train", icon: "🎙" },
  { href: "/quiz/phonetic", label: "Phonetic", icon: "🔤" },
  { href: "/sim/movement", label: "Movement", icon: "🛫" }
];

const activeRoutes = new Set(["/", "/quiz/phonetic", "/sim/movement", "/mobile_train"]);

export function StickyNav() {
  const pathname = usePathname();
  const basePath = pathname?.split("?")[0] ?? "/";
  const shouldShow = activeRoutes.has(basePath) || basePath === "/";

  if (!shouldShow) {
    return null;
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-md sm:hidden"
      aria-label="Primary"
    >
      <ul className="flex items-center justify-around px-4 py-3">
        {links.map((item) => {
          const isActive = basePath === item.href || (basePath === "/" && item.href === "/mobile_train");
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? "bg-sky-500/20 text-sky-200"
                    : "text-slate-300 hover:text-slate-100"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
