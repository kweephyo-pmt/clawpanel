"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionStage, setTransitionStage] = useState<"enter" | "exit">("enter");
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      // Start exit animation
      setTransitionStage("exit");

      const timer = setTimeout(() => {
        prevPathname.current = pathname;
        setDisplayChildren(children);
        setTransitionStage("enter");
      }, 120); // matches the exit animation duration

      return () => clearTimeout(timer);
    } else {
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  return (
    <div
      style={{
        animation: transitionStage === "enter"
          ? "pageEnter 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94) both"
          : "pageExit 0.12s ease-in both",
        willChange: "opacity, transform",
      }}
    >
      <style>{`
        @keyframes pageEnter {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pageExit {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-4px);
          }
        }
      `}</style>
      {displayChildren}
    </div>
  );
}
