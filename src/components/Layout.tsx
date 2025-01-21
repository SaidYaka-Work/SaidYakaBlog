import React from 'react';
import Link from 'next/link';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm">
        <nav className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-xl font-bold text-gray-800 hover:text-gray-600">
              Blog
            </Link>
            <div className="space-x-4">
              <Link href="/posts" className="text-gray-600 hover:text-gray-800">
                Posts
              </Link>
              <Link href="/tags" className="text-gray-600 hover:text-gray-800">
                Tags
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8">
        {children}
      </main>

      <footer className="bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-600">
            <p>© {new Date().getFullYear()} Blog. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 