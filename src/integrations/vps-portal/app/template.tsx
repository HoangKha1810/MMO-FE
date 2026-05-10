export default function RootTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="route-transition-frame">
      <div className="route-transition-shell">{children}</div>
    </div>
  );
}
