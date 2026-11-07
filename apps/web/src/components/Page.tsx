import { Helmet } from "react-helmet-async";

export function Page({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <>
      <Helmet>
        <title>{`${title} | LinkedOut`}</title>
        {description && <meta name="description" content={description} />}
      </Helmet>
      {children}
    </>
  );
}
