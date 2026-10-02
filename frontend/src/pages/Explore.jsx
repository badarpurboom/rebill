import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function Explore() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef(null)

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const modules = useMemo(() => [
    {
      id: 'menu',
      title: 'Menu Manager',
      path: '/menu',
      animateClass: 'card-animate-1',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
    },
    {
      id: 'customer',
      title: 'Customer',
      path: '/customers',
      animateClass: 'card-animate-2',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.33a4.125 4.125 0 00-6.338 0 .375.375 0 00.262.62h5.814a.375.375 0 00.262-.62z" />
        </svg>
      ),
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      path: '/whatsapp',
      animateClass: 'card-animate-3',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l.169.273-1.031 3.766 3.864-1.013.261.155z" />
        </svg>
      ),
    },
    {
      id: 'orders',
      title: 'Order History',
      path: '/orders',
      animateClass: 'card-animate-4',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
        </svg>
      ),
    },
    {
      id: 'coupons',
      title: 'Coupons & Promotion',
      path: '/coupons',
      animateClass: 'card-animate-5',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
      ),
    },
    {
      id: 'reports',
      title: 'Analytics Report',
      path: '/reports',
      animateClass: 'card-animate-6',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    },
    {
      id: 'tables-mgmt',
      title: 'Table Management',
      path: '/table-management',
      animateClass: 'card-animate-7',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
  ], [])

  const filteredModules = useMemo(() => {
    return modules.filter((m) =>
      m.title.toLowerCase().includes(searchTerm.toLowerCase().trim())
    )
  }, [modules, searchTerm])

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50 text-slate-900 overflow-y-auto">
      {/* Styles for animation */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .card-animate-1 { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.04s backwards; }
        .card-animate-2 { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.08s backwards; }
        .card-animate-3 { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.12s backwards; }
        .card-animate-4 { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.16s backwards; }
        .card-animate-5 { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.20s backwards; }
        .card-animate-6 { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.24s backwards; }
        .card-animate-7 { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.28s backwards; }
      `}</style>

      {/* Floating Curved Top Header Bar */}
      <div className="sticky top-3 z-30 px-4 sm:px-6 lg:px-8 shrink-0">
        <header className="h-14 sm:h-15 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xs flex items-center justify-between px-4 sm:px-6 gap-3">
          {/* Title with Compass Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#FF5436] to-[#E8143A] flex items-center justify-center text-white shadow-xs shadow-red-500/20">
              <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9.75" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight leading-none">Explore Center</h1>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5 hidden sm:block">Quick access module cluster</p>
            </div>
          </div>

          {/* Curved Search Box */}
          <div className="relative flex-1 max-w-xs sm:max-w-sm">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-100/90 hover:bg-slate-100 border border-slate-200/80 rounded-full text-slate-500 focus-within:ring-2 focus-within:ring-red-500/20 focus-within:border-red-500 focus-within:bg-white transition-all shadow-xs">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search module (/)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-[11px] font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none w-full"
              />
              {searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1 cursor-pointer"
                >
                  ✕
                </button>
              ) : (
                <kbd className="hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-400 border border-slate-200 shadow-2xs">
                  /
                </kbd>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Main Content Area: 1 Row with 6 Compact Cards */}
      <main className="flex-1 w-full bg-slate-50 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="flex flex-col w-full">
          {/* 7 Cards across Responsive Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 xl:gap-4" id="modules-container">
            {filteredModules.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`${item.animateClass} group relative bg-white hover:border-red-500/40 p-4 sm:p-4.5 xl:p-5 flex flex-col justify-between aspect-square transition-all duration-300 ease-out rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:shadow-red-500/10 hover:-translate-y-1.5 cursor-pointer overflow-hidden active:scale-[0.98]`}
              >
                {/* Background Hover Gradients */}
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/[0.07] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl" />
                <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/5 rounded-full blur-xl group-hover:bg-red-500/10 transition-all pointer-events-none" />

                {/* Card Top: Red Icon Box + Pulse Pill Indicator */}
                <div className="relative z-10 flex items-start justify-between">
                  <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-sm shadow-red-600/30 group-hover:scale-105 group-hover:bg-red-700 transition-all duration-300 ease-out">
                    {item.icon}
                  </div>
                  <div className="relative flex items-center justify-center p-1 bg-slate-50/80 group-hover:bg-red-50/80 rounded-full border border-slate-200/60 group-hover:border-red-200 transition-colors">
                    <span className="absolute w-1.5 h-1.5 bg-red-600 rounded-full animate-ping opacity-75" />
                    <span className="relative w-1.5 h-1.5 bg-red-600 rounded-full shadow-[0_0_6px_rgba(220,38,38,0.7)]" />
                  </div>
                </div>

                {/* Card Center: Title */}
                <div className="relative z-10 flex flex-col gap-0.5 my-auto py-1">
                  <h2 className="text-[13px] sm:text-[14px] xl:text-[15px] font-bold text-slate-900 leading-tight tracking-tight group-hover:text-red-600 group-hover:translate-x-0.5 transition-all duration-300 line-clamp-2">
                    {item.title}
                  </h2>
                </div>

                {/* Bottom subtle bar accent on hover */}
                <div className="relative z-10 flex items-center justify-between text-[11px] font-semibold text-slate-400 group-hover:text-red-600 transition-colors pt-1 border-t border-slate-100/60">
                  <span className="text-[9px] font-mono tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                    Open
                  </span>
                  <svg className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {filteredModules.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-2.5">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800">No matching module found</h3>
              <p className="mt-1 text-xs text-slate-500 font-mono">
                No module matches "{searchTerm}"
              </p>
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="mt-3.5 px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
