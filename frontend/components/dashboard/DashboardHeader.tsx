import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';

export default function DashboardHeader() {
  const { user } = useAuthStore();
  const router = useRouter();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getTimeBasedIcon = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅'; // Morning
    if (hour < 17) return '☀️'; // Afternoon
    return '🌙'; // Evening
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <span className="text-2xl">{getTimeBasedIcon()}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {getGreeting()}, {user?.firstName}!
            </h1>
            <p className="text-blue-100 mt-1">
              Welcome back to your PayMo dashboard
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center space-x-6">
          <div className="text-right">
            <div className="text-sm text-blue-100">Account</div>
            <div className="font-semibold">{user?.email}</div>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <span className="text-lg font-semibold">
              {user?.firstName?.charAt(0).toUpperCase()}
              {user?.lastName?.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 flex flex-wrap gap-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20">
          <div className="text-xs text-blue-100 uppercase tracking-wide">Quick Actions</div>
        </div>
        <button
          onClick={() => router.push('/dashboard/create-product')}
          className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20 transition-all duration-200 transform hover:scale-105 cursor-pointer"
        >
          <span className="text-sm font-medium">Create Product</span>
        </button>
        <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20 transition-all duration-200 transform hover:scale-105">
          <span className="text-sm font-medium">View Analytics</span>
        </button>
        <button className="bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/20 transition-all duration-200 transform hover:scale-105">
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </div>
  );
}
