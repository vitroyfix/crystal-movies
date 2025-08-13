const ComingSoon = () => {
  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center px-4 text-center relative"
      style={{
        backgroundImage:
          "url('https://i.pinimg.com/1200x/a5/86/ac/a586ac3a3aaf5bd37bfbb32104599000.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-black/90"></div>
      <div className="relative z-10 max-w-lg">
        <h1 className="text-6xl font-extrabold text-white tracking-wide mb-4">Coming Soon</h1>
        <p className="text-gray-300 text-xl mb-10">
          This page is under construction. Check back later!
        </p>
        <div className="w-24 h-1 bg-yellow-400 rounded-full mx-auto animate-pulse"></div>
      </div>
    </div>
  );
};

export default ComingSoon;
