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
      }, 150); // matches the exit animation duration

      return () => clearTimeout(timer);
    } else {
      setDisplayChildren(children);
    }
  }, [pathname, children]);

  return (
    <div
      style={{
        animation: transitionStage === "enter"
          ? "pageEnter 0.4s cubic-bezier(0, 0, 0.2, 1) both"
          : "pageExit 0.15s cubic-bezier(0.4, 0, 1, 1) both",
        willChange: "opacity, transform",
      }}
    >
      <style>{`
        @keyframes pageEnter {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pageExit {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
      `}</style>
      {displayChildren}
    </div>
  );
}
