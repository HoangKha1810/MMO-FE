import type { Metadata } from 'next';
import { UserLayoutContent } from './user-layout-content';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return <UserLayoutContent>{children}</UserLayoutContent>;
}
