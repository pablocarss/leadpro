export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-gray-100 to-black/10 dark:from-black dark:via-gray-900 dark:to-white/10">
      <div className="w-full max-w-md p-8">
        {children}
      </div>
    </div>
  );
}
