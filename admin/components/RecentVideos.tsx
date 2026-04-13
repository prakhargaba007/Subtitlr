function RecentVideos() {
  return (
    <>
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 max-w-md w-full text-center shadow-2xl hover:shadow-3xl transition-all duration-500 hover:-translate-y-2 float-animation">
        <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 pulse-glow">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Payment Pending
        </h2>
        <p className="text-gray-600 mb-6 text-lg">I haven't paid well yet</p>

        <div className="inline-flex items-center px-4 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold mb-6">
          <div className="w-2 h-2 bg-amber-500 rounded-full mr-2 animate-pulse"></div>
          Action Required
        </div>
      </div>
    </>
  );
}

export default RecentVideos;
