'use client';

import Link from 'next/link';
import {
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';
import { useCallback, useMemo, type ComponentProps } from 'react';

type NavigateOptions = {
  replace?: boolean;
};

type SetSearchParams = (
  params: URLSearchParams,
  options?: NavigateOptions,
) => void;

export function useNavigate() {
  const router = useRouter();

  return useCallback(
    (href: string, options?: NavigateOptions) => {
      if (options?.replace) router.replace(href);
      else router.push(href);
    },
    [router],
  );
}

export function useLocation() {
  const pathname = usePathname();
  return useMemo(() => ({ pathname }), [pathname]);
}

export function useSearchParams(): [URLSearchParams, SetSearchParams] {
  const router = useRouter();
  const pathname = usePathname();
  const nextSearchParams = useNextSearchParams();
  const params = useMemo(
    () => new URLSearchParams(nextSearchParams.toString()),
    [nextSearchParams],
  );

  const setSearchParams = useCallback<SetSearchParams>(
    (nextParams, options) => {
      const query = nextParams.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      if (options?.replace) router.replace(href);
      else router.push(href);
    },
    [pathname, router],
  );

  return [params, setSearchParams];
}

type NavLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  to: string;
};

export function NavLink({ to, ...props }: NavLinkProps) {
  return <Link href={to} {...props} />;
}
