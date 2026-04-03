"use client";

export default function Navbar() {
  return (
    <header className="fixed top-0 w-full z-50 glass-nav shadow-sm">
      <nav className="flex justify-between items-center px-8 py-4 max-w-7xl mx-auto">
        <div className="text-2xl font-bold tracking-tighter text-indigo-700 font-headline">
          Subtitlr
        </div>

        <div className="hidden md:flex items-center space-x-10 font-headline font-medium text-sm tracking-tight">
          <a href="#"        className="text-slate-600 hover:text-indigo-600 transition-colors duration-300">Platform</a>
          <a href="#"        className="text-slate-600 hover:text-indigo-600 transition-colors duration-300">Features</a>
          <a href="#pricing" className="text-slate-600 hover:text-indigo-600 transition-colors duration-300">Pricing</a>
          <a href="#"        className="text-slate-600 hover:text-indigo-600 transition-colors duration-300">Documentation</a>
        </div>

        <div className="flex items-center space-x-6">
          <button className="text-slate-600 font-medium text-sm hover:text-indigo-600 transition-colors">
            Sign In
          </button>
          <button className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-full font-headline text-sm font-semibold hover:shadow-[0_0_15px_rgba(57,44,193,0.3)] transition-all scale-100 hover:scale-[1.02] active:scale-95">
            Get Started
          </button>
        </div>
      </nav>
    </header>
  );
}
