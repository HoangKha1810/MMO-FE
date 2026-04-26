import { redirect } from 'next/navigation';

export default async function LegacyDepositPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = new URLSearchParams();

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
      return;
    }

    if (typeof value === 'string') {
      query.set(key, value);
    }
  });

  redirect(`/user/deposit${query.size ? `?${query.toString()}` : ''}`);
}
