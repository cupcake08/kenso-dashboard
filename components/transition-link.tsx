"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

interface TransitionLinkProps extends React.ComponentProps<typeof Link> {
  transitionName?: string;
}

export function TransitionLink({
  transitionName,
  onClick,
  ...props
}: TransitionLinkProps) {
  const router = useRouter();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;

      const supportsVT = "startViewTransition" in document;
      if (!supportsVT || !transitionName) return;

      e.preventDefault();

      (document as Document & { startViewTransition: (cb: () => void) => void })
        .startViewTransition(() => {
          router.push(props.href.toString());
        });
    },
    [onClick, transitionName, router, props.href]
  );

  return <Link {...props} onClick={handleClick} />;
}
