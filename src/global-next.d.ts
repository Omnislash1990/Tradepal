/** Fallback route prop types used before `next dev` generates `.next/types`. */
type PageProps<_Path extends string = string> = {
  params: Promise<Record<string, string>>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type LayoutProps<_Path extends string = string> = {
  children: React.ReactNode;
};
